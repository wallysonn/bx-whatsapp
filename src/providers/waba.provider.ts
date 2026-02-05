import { AxiosError } from 'axios'
import { IMessageConfirm } from './interfaces/message-confirm.interface'
import { IProviderMessage } from './interfaces/provider-message.interface'
import { Provider } from './provider'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { createWriteStream } from 'fs'

interface WabaProviderConfigInterface {
  access_token: string
  business_account_id: string
  phone_number_id: string
  version?: string
  temp_dir?: string
}

interface MediaDownloadResult {
  filepath: string // Caminho local do arquivo (file://...)
  filename: string // Nome do arquivo original
  mimeType: string
  sha256: string
  fileSize: number
}

export class WABAProvider extends Provider implements IProviderMessage {
  private readonly API_URL: string = 'https://graph.facebook.com'
  private baseUrl: string
  private config: WabaProviderConfigInterface
  private tempDir: string = '/tmp/waba'
  private version: string = 'v22.0'

  constructor(config: WabaProviderConfigInterface) {
    super()

    this.baseUrl = `${this.API_URL}/{version}/{phone_number_id}`
    this.config = config

    if (!this.config.access_token || !this.config.business_account_id || !this.config.phone_number_id) {
      throw new Error('access_token, business_account_id e phone_number_id são obrigatórios')
    }

    this.version = config.version || 'v22.0'
    this.baseUrl = this.baseUrl.replace('{version}', this.version).replace('{phone_number_id}', config.phone_number_id)

    this.clientHttp.defaults.headers.common['Authorization'] = `Bearer ${this.config.access_token}`
    this.clientHttp.defaults.headers.common['Content-Type'] = 'application/json'

    // Configura diretório temporário
    this.tempDir = config.temp_dir || path.join(process.cwd(), 'temp', 'whatsapp-media')
    this.ensureTempDirExists()

    //delete old files
    this.cleanOldTempFiles()
  }

  private ensureTempDirExists(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true })
    }
  }

  /**
   * Obtém informações sobre a mídia (URL de download, mime type, etc)
   * @param mediaId ID da mídia recebido no webhook
   */
  private async getMediaInfo(mediaId: string): Promise<{
    url: string
    mime_type: string
    sha256: string
    file_size: number
  }> {
    try {
      const url = `${this.API_URL}/${this.version}/${mediaId}`
      const { data } = await this.clientHttp.get(url)

      return data
    } catch (err) {
      const axiosError = err as AxiosError
      console.error('Erro ao obter informações da mídia:', axiosError?.response?.data)
      throw err
    }
  }

  /**
   * Faz o download da mídia e salva localmente
   * @param mediaId ID da mídia recebido no webhook
   * @param mimeType Tipo MIME do arquivo
   * @param sha256 Hash SHA256 para validação (opcional)
   */
  async downloadMedia(
    mediaId: string,
    mimeType?: string,
    sha256?: string,
    name?: string
  ): Promise<MediaDownloadResult> {
    try {
      // Passo 1: Obter URL de download e informações da mídia
      const mediaInfo = await this.getMediaInfo(mediaId)
      const downloadUrl = mediaInfo.url
      const actualMimeType = mimeType || mediaInfo.mime_type
      const fileSize = mediaInfo.file_size

      console.log(`Baixando mídia ${mediaId} de ${downloadUrl}`)

      // Passo 2: Determinar extensão do arquivo baseado no mime type
      const extension = this.getExtensionFromMimeType(actualMimeType)
      const filename = `${name || mediaId}_${Date.now()}${extension}`
      const filepath = path.join(this.tempDir, filename)

      // Passo 3: Fazer download do arquivo
      const response = await this.clientHttp.get(downloadUrl, {
        responseType: 'stream'
      })

      // Passo 4: Salvar arquivo localmente
      const writer = createWriteStream(filepath)
      await pipeline(response.data, writer)

      console.log(`Mídia salva em: ${filepath}`)

      return {
        filepath: `file://${filepath}`,
        filename: filename,
        mimeType: actualMimeType,
        sha256: sha256 || '',
        fileSize: fileSize || fs.statSync(filepath).size
      }
    } catch (err) {
      const axiosError = err as AxiosError
      console.error('Erro ao baixar mídia:', axiosError?.response?.data || err)
      throw err
    }
  }

  /**
   * Processa mensagem de mídia recebida do webhook
   * @param webhookMessage Objeto da mensagem do webhook
   */
  async processMediaMessage(webhookMessage: any): Promise<MediaDownloadResult> {
    const messageType = webhookMessage.type
    const mediaData = webhookMessage[messageType] // image, video, audio, document, etc

    if (!mediaData || !mediaData.id) {
      throw new Error('Mensagem não contém dados de mídia válidos')
    }

    return await this.downloadMedia(mediaData.id, mediaData.mime_type, mediaData.sha256)
  }

  /**
   * Remove arquivo temporário
   */
  async deleteMediaFile(filepath: string): Promise<void> {
    try {
      const cleanPath = filepath.replace('file://', '')
      if (fs.existsSync(cleanPath)) {
        fs.unlinkSync(cleanPath)
        console.log(`Arquivo removido: ${cleanPath}`)
      }
    } catch (err) {
      console.error('Erro ao remover arquivo:', err)
    }
  }

  /**
   * Limpa arquivos temporários antigos (mais de X horas)
   */
  async cleanOldTempFiles(hoursOld: number = 24): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir)
      const now = Date.now()
      const maxAge = hoursOld * 60 * 60 * 1000 // 24 horas em milissegundos

      for (const file of files) {
        const filepath = path.join(this.tempDir, file)
        const stats = fs.statSync(filepath)
        const fileAge = now - stats.mtimeMs

        if (fileAge > maxAge) {
          fs.unlinkSync(filepath)
          console.log(`Arquivo antigo removido: ${filepath}`)
        }
      }
    } catch (err) {
      console.error('Erro ao limpar arquivos temporários:', err)
    }
  }

  /**
   * Retorna a extensão do arquivo baseado no mime type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'audio/aac': '.aac',
      'audio/mp4': '.m4a',
      'audio/mpeg': '.mp3',
      'audio/amr': '.amr',
      'audio/ogg': '.ogg',
      'application/pdf': '.pdf',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/msword': '.doc',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt'
    }

    return mimeMap[mimeType] || ''
  }

  /**
   * Cria objeto de mensagem baseado no tipo e destinatário
   */
  objectMessage(type: string, to: string, messageRefId?: string): any {
    let data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type
    } as any

    if (messageRefId) {
      data.context = {
        message_id: messageRefId
      }
    }

    return data
  }

  private async sendMessage(objectMessage: any): Promise<IMessageConfirm> {
    try {
      console.log(`send message to ${this.baseUrl}/messages`, objectMessage)
      const { data } = await this.clientHttp.post(`${this.baseUrl}/messages`, objectMessage)
      return {
        messageId: data?.messages?.[0]?.id ?? '',
        insertedId: '',
        instanceId: this.config.phone_number_id
      }
    } catch (err) {
      const axiosError = err as AxiosError
      console.log('erro no envio do mensagem', objectMessage, axiosError?.response?.data)
      //trigger exception error
      throw err
    }
  }

  async sendMessageText(phone: string, message: string, messageRefId?: string): Promise<IMessageConfirm> {
    console.log('enviando mensagem de texto', phone, message)
    const base = this.objectMessage('text', phone, messageRefId)
    const obj = {
      ...base,
      text: {
        preview_url:
          message.toString().toLowerCase().includes('http://') || message.toString().toLowerCase().includes('https://'),
        body: message
      }
    }
    const confirm = await this.sendMessage(obj)

    return confirm
  }

  sendMessageImage(phone: string, image: string): Promise<IMessageConfirm> {
    throw new Error('sendMessageImage não implementado')
  }
  sendMessageVideo(phone: string, video: string): Promise<IMessageConfirm> {
    throw new Error('sendMessageVideo não implementado')
  }
  sendMessageAudio(phone: string, audio: string): Promise<IMessageConfirm> {
    throw new Error('sendMessageAudio não implementado')
  }
  sendMessageFile(phone: string, file: string): Promise<IMessageConfirm> {
    throw new Error('sendMessageFile não implementado')
  }
}
