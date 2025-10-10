import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  BucketLocationConstraint
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import http from '../api/http'
import { ITenant } from '../interfaces/ITenant'
import { createHash } from 'crypto'
import path from 'path'
import { AWS_S3 } from '../env'
import { WhatsAppDecryptModule } from './whatsapp-decrypt.module'

export interface S3UploadResult {
  key: string
  bucket: string
  region: string
  originalUrl: string
  signedUrl: string
  urlExpiresAt: string
  fileSize: number
  contentType: string
  uploadedAt: string
}

export interface S3UploadOptions {
  urlExpiresIn?: number
  connectedPhone?: string
  messageId?: string
  mediaKey?: string
  fileSha256?: string
  fileEncSha256?: string
  mediaType?: 'image' | 'video' | 'audio' | 'document'
  maxRetries?: number
  enableParallelUpload?: boolean
}

export class AmazonS3Module {
  private s3Client: S3Client
  private region: string
  private bucketCache = new Set<string>()

  constructor() {
    this.region = AWS_S3.REGION
    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: AWS_S3.ACCESS_KEY_ID,
        secretAccessKey: AWS_S3.SECRET_ACCESS_KEY
      },
      maxAttempts: 3,
      retryMode: 'adaptive'
    })
  }

  /**
   * Upload otimizado de arquivo de mídia com descriptografia automática
   */
  async uploadMediaFile(mediaUrl: string, tenant: ITenant, options: S3UploadOptions = {}): Promise<S3UploadResult> {
    const startTime = Date.now()
    const {
      urlExpiresIn = 30 * 24 * 60 * 60, //30 dias
      connectedPhone = 'unknown',
      messageId = this.generateMessageId(),
      mediaKey,
      fileSha256,
      fileEncSha256,
      mediaType,
      maxRetries = 3
    } = options

    try {
      console.log(`🔄 [S3] Iniciando upload - MessageID: ${messageId}`)
      console.log(`🔄 [S3] Tenant: ${tenant.name} (${tenant.uuid})`)
      console.log(`🔄 [S3] URL: ${mediaUrl.substring(0, 100)}...`)

      const bucketName = this.getTenantBucketName(tenant)
      await this.ensureBucketExists(bucketName)

      // Processar arquivo (descriptografia ou download direto)
      const { buffer, mimetype, processingMethod } = await this.processMediaFile(
        mediaUrl,
        mediaKey,
        mediaType,
        fileSha256,
        fileEncSha256
      )

      console.log(`✅ [S3] Arquivo processado via ${processingMethod} - Tamanho: ${buffer.length} bytes`)

      // Gerar chave única do S3
      const s3Key = this.generateS3Key(buffer, messageId, connectedPhone, mimetype)
      console.log(`🔄 [S3] Chave gerada: ${s3Key}`)

      // Upload para S3 com retry
      await this.uploadToS3WithRetry(
        bucketName,
        s3Key,
        buffer,
        mimetype,
        {
          mediaUrl,
          messageId,
          tenant,
          processingMethod
        },
        maxRetries
      )

      // Gerar URL assinada
      const signedUrl = await this.generateSignedUrlDirect(bucketName, s3Key, urlExpiresIn)
      const urlExpiresAt = new Date(Date.now() + urlExpiresIn * 1000).toISOString()
      const uploadedAt = new Date().toISOString()

      const processingTime = Date.now() - startTime
      console.log(`🎉 [S3] Upload concluído em ${processingTime}ms`)
      console.log(`🎉 [S3] Bucket: ${bucketName}, Key: ${s3Key}`)
      console.log(`🎉 [S3] URL expira em: ${urlExpiresAt}`)

      return {
        key: s3Key,
        bucket: bucketName,
        region: this.region,
        originalUrl: mediaUrl,
        signedUrl,
        urlExpiresAt,
        fileSize: buffer.length,
        contentType: mimetype,
        uploadedAt
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime
      console.error(`❌ [S3] ERRO após ${processingTime}ms:`)
      console.error(`❌ [S3] MessageID: ${messageId}`)
      console.error(`❌ [S3] Tenant: ${tenant.name}`)
      console.error(`❌ [S3] Erro: ${error.message}`)
      console.error(`❌ [S3] Stack: ${error.stack}`)

      throw new Error(`S3 Upload Error [${messageId}]: ${error.message}`)
    }
  }

  /**
   * Processa arquivo de mídia (descriptografia ou download direto)
   */
  private async processMediaFile(
    mediaUrl: string,
    mediaKey?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document',
    fileSha256?: string,
    fileEncSha256?: string
  ): Promise<{ buffer: Buffer; mimetype: string; processingMethod: string }> {
    // Verificar se precisa descriptografar
    const needsDecryption = this.needsDecryption(mediaUrl, mediaKey, mediaType)

    if (needsDecryption) {
      console.log(`🔄 [PROCESS] Iniciando descriptografia WhatsApp...`)

      const decryptResult = await WhatsAppDecryptModule.decryptMedia(
        mediaUrl,
        mediaKey!,
        mediaType!,
        fileSha256,
        fileEncSha256
      )

      return {
        buffer: decryptResult.decryptedData,
        mimetype: decryptResult.mimetype,
        processingMethod: 'decrypt'
      }
    } else {
      console.log(`🔄 [PROCESS] Download direto (arquivo não criptografado)...`)

      const response = await http.get(mediaUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 5
      })

      const buffer = Buffer.from(response.data)
      const mimetype = response.headers['content-type'] || this.inferMimetypeFromUrl(mediaUrl)

      return {
        buffer,
        mimetype,
        processingMethod: 'direct'
      }
    }
  }

  /**
   * Verifica se o arquivo precisa de descriptografia
   */
  private needsDecryption(
    mediaUrl: string,
    mediaKey?: string,
    mediaType?: 'image' | 'video' | 'audio' | 'document'
  ): boolean {
    return !!(mediaKey && mediaType && (mediaUrl.includes('.enc') || mediaUrl.includes('whatsapp.net')))
  }

  /**
   * Upload para S3 com retry automático
   */
  private async uploadToS3WithRetry(
    bucketName: string,
    key: string,
    buffer: Buffer,
    mimetype: string,
    metadata: {
      mediaUrl: string
      messageId: string
      tenant: ITenant
      processingMethod: string
    },
    maxRetries: number
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [S3-UPLOAD] Tentativa ${attempt}/${maxRetries} - Bucket: ${bucketName}`)

        const uploadCommand = new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: buffer,
          ContentType: mimetype,
          ContentLength: buffer.length,
          Metadata: {
            'original-url': metadata.mediaUrl,
            'message-id': metadata.messageId,
            'tenant-id': metadata.tenant.id.toString(),
            'tenant-uuid': metadata.tenant.uuid,
            'tenant-name': metadata.tenant.name.replace(/[^\w\s-]/g, ''), // Sanitizar
            'processing-method': metadata.processingMethod,
            'upload-date': new Date().toISOString(),
            'file-size': buffer.length.toString(),
            'content-type': mimetype
          },
          ServerSideEncryption: 'AES256', // Criptografia do lado do servidor
          StorageClass: 'STANDARD_IA' // Classe de armazenamento otimizada
        })

        await this.s3Client.send(uploadCommand)
        console.log(`✅ [S3-UPLOAD] Upload bem-sucedido na tentativa ${attempt}`)
        return
      } catch (error: any) {
        console.warn(`⚠️ [S3-UPLOAD] Tentativa ${attempt} falhou: ${error.message}`)

        if (attempt === maxRetries) {
          throw new Error(`Upload S3 falhou após ${maxRetries} tentativas: ${error.message}`)
        }

        // Aguardar antes da próxima tentativa (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Garantir que o bucket existe
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    if (this.bucketCache.has(bucketName)) {
      return
    }

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }))
      this.bucketCache.add(bucketName)
      console.log(`✅ [S3-BUCKET] Bucket verificado: ${bucketName}`)
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        console.log(`🔄 [S3-BUCKET] Criando bucket: ${bucketName}`)

        try {
          const createBucketConfig: any = {
            Bucket: bucketName
          }

          // Só adicionar LocationConstraint se não for us-east-1
          if (this.region !== 'us-east-1') {
            createBucketConfig.CreateBucketConfiguration = {
              LocationConstraint: this.region as BucketLocationConstraint
            }
          }

          await this.s3Client.send(new CreateBucketCommand(createBucketConfig))

          this.bucketCache.add(bucketName)
          console.log(`✅ [S3-BUCKET] Bucket criado: ${bucketName}`)
        } catch (createError: any) {
          throw new Error(`Falha ao criar bucket ${bucketName}: ${createError.message}`)
        }
      } else {
        throw new Error(`Erro ao verificar bucket ${bucketName}: ${error.message}`)
      }
    }
  }

  /**
   * Gerar chave S3 otimizada
   */
  private generateS3Key(buffer: Buffer, messageId: string, connectedPhone: string, mimetype: string): string {
    const hash = createHash('md5').update(buffer).digest('hex')
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const fileExtension = this.getFileExtension(mimetype)

    return `whatsapp-media/${connectedPhone}/${timestamp}/${messageId}/${hash}${fileExtension}`
  }

  /**
   * Obter nome do bucket baseado no tenant
   */
  private getTenantBucketName(tenant: ITenant): string {
    return tenant.uuid.toLowerCase()
  }

  /**
   * Gerar URL assinada
   */
  async generateSignedUrl(key: string, tenant: ITenant, expiresIn: number = 3600): Promise<string> {
    const bucketName = this.getTenantBucketName(tenant)
    return this.generateSignedUrlDirect(bucketName, key, expiresIn)
  }

  /**
   * Gerar URL assinada diretamente
   */
  async generateSignedUrlDirect(bucket: string, key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      })

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
        signableHeaders: new Set(['host']) // Otimização para assinatura
      })

      return signedUrl
    } catch (error: any) {
      console.error(`❌ [S3-URL] Erro ao gerar URL assinada: ${error.message}`)
      throw new Error(`Falha ao gerar URL assinada: ${error.message}`)
    }
  }

  /**
   * Determinar extensão do arquivo baseada no mimetype
   */
  private getFileExtension(mimetype: string, filename?: string): string {
    if (filename) {
      return path.extname(filename)
    }

    const mimetypeMap: { [key: string]: string } = {
      // Imagens
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/svg+xml': '.svg',

      // Vídeos
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
      'video/mkv': '.mkv',
      'video/flv': '.flv',
      'video/wmv': '.wmv',

      // Áudios
      'audio/mpeg': '.mp3',
      'audio/mp3': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/mp4': '.m4a',
      'audio/aac': '.aac',
      'audio/flac': '.flac',
      'audio/wma': '.wma',

      // Documentos
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'text/plain': '.txt',
      'text/csv': '.csv',
      'application/json': '.json',
      'application/xml': '.xml',
      'text/html': '.html',

      // Compactados
      'application/zip': '.zip',
      'application/x-rar-compressed': '.rar',
      'application/x-7z-compressed': '.7z',
      'application/gzip': '.gz'
    }

    return mimetypeMap[mimetype] || '.bin'
  }

  /**
   * Inferir mimetype da URL
   */
  private inferMimetypeFromUrl(url: string): string {
    try {
      const urlPath = new URL(url).pathname.toLowerCase()

      // Mapear extensões para mimetypes
      const extensionMap: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/avi',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf'
      }

      for (const [ext, mimetype] of Object.entries(extensionMap)) {
        if (urlPath.endsWith(ext)) {
          return mimetype
        }
      }

      // Fallback baseado no domínio/padrão WhatsApp
      if (url.includes('whatsapp.net')) {
        if (url.includes('image') || url.includes('img')) return 'image/jpeg'
        if (url.includes('video')) return 'video/mp4'
        if (url.includes('audio')) return 'audio/ogg'
        if (url.includes('document')) return 'application/octet-stream'
      }

      return 'application/octet-stream'
    } catch (error) {
      return 'application/octet-stream'
    }
  }

  /**
   * Gerar ID de mensagem único se não fornecido
   */
  private generateMessageId(): string {
    return createHash('md5').update(`${Date.now()}-${Math.random()}`).digest('hex').toUpperCase()
  }

  /**
   * Verificar se é um tipo de mídia suportado
   */
  static isSupportedMediaType(mimetype: string): boolean {
    const supportedTypes = [
      'image/',
      'video/',
      'audio/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument',
      'application/vnd.ms-excel',
      'application/vnd.ms-powerpoint',
      'text/plain',
      'text/csv',
      'application/json'
    ]

    return supportedTypes.some(type => mimetype.startsWith(type))
  }

  /**
   * Obter estatísticas do bucket (opcional - para monitoramento)
   */
  async getBucketStats(tenant: ITenant): Promise<{
    bucketName: string
    exists: boolean
    region: string
  }> {
    const bucketName = this.getTenantBucketName(tenant)

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: bucketName }))
      return {
        bucketName,
        exists: true,
        region: this.region
      }
    } catch (error) {
      return {
        bucketName,
        exists: false,
        region: this.region
      }
    }
  }

  /**
   * Limpar cache de buckets (útil em testes ou reinicialização)
   */
  clearBucketCache(): void {
    this.bucketCache.clear()
    console.log(`🔄 [S3] Cache de buckets limpo`)
  }
}
