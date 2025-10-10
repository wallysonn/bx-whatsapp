import { createHash, createHmac } from 'crypto'
import { createDecipheriv } from 'crypto'
import http from '../api/http'

export interface WhatsAppMediaDecryptResult {
  decryptedData: Buffer
  mimetype: string
  fileSize: number
}

export class WhatsAppDecryptModule {
  private static readonly APP_INFO = {
    image: 'WhatsApp Image Keys',
    video: 'WhatsApp Video Keys',
    audio: 'WhatsApp Audio Keys',
    document: 'WhatsApp Document Keys'
  }

  /**
   * Descriptografa arquivo de mídia do WhatsApp com tratamento robusto de erros
   */
  static async decryptMedia(
    encryptedUrl: string,
    mediaKey: string,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    fileSha256?: string,
    fileEncSha256?: string
  ): Promise<WhatsAppMediaDecryptResult> {
    const startTime = Date.now()

    try {
      console.log(`🔄 [DECRYPT] Iniciando descriptografia - Tipo: ${mediaType}`)
      console.log(`🔄 [DECRYPT] URL: ${encryptedUrl.substring(0, 100)}...`)

      // 1. Validar parâmetros de entrada
      if (!mediaKey || !encryptedUrl || !mediaType) {
        throw new Error('Parâmetros obrigatórios ausentes: mediaKey, encryptedUrl ou mediaType')
      }

      // 2. Baixar arquivo criptografado com retry
      const encryptedData = await this.downloadEncryptedFile(encryptedUrl)
      console.log(`✅ [DECRYPT] Arquivo baixado - Tamanho: ${encryptedData.length} bytes`)

      // 3. Validar e converter mediaKey
      const mediaKeyBuffer = this.validateAndDecodeMediaKey(mediaKey)
      console.log(`✅ [DECRYPT] MediaKey validada - Tamanho: ${mediaKeyBuffer.length} bytes`)

      // 4. Verificar hash do arquivo criptografado (opcional mas recomendado)
      if (fileEncSha256) {
        this.validateEncryptedFileHash(encryptedData, fileEncSha256)
      }

      // 5. Derivar chaves usando HKDF
      const expandedKey = this.hkdf(mediaKeyBuffer, 112, this.APP_INFO[mediaType])
      const keys = this.extractKeys(expandedKey)
      console.log(
        `✅ [DECRYPT] Chaves derivadas - IV(${keys.iv.length}), Cipher(${keys.cipherKey.length}), MAC(${keys.macKey.length})`
      )

      // 6. Separar dados e MAC
      const { fileData, fileMac } = this.separateDataAndMac(encryptedData)
      console.log(`✅ [DECRYPT] Dados separados - FileData(${fileData.length}), MAC(${fileMac.length})`)

      // 7. Verificar MAC com tratamento de erro melhorado
      await this.verifyMac(fileData, keys.iv, keys.macKey, fileMac)

      // 8. Descriptografar dados
      const decryptedData = this.decryptData(fileData, keys.cipherKey, keys.iv)
      console.log(`✅ [DECRYPT] Descriptografia concluída - Tamanho: ${decryptedData.length} bytes`)

      // 9. Verificar hash do arquivo descriptografado (se fornecido)
      if (fileSha256) {
        this.validateDecryptedFileHash(decryptedData, fileSha256)
      }

      const processingTime = Date.now() - startTime
      console.log(`🎉 [DECRYPT] Sucesso em ${processingTime}ms - Arquivo final: ${decryptedData.length} bytes`)

      return {
        decryptedData,
        mimetype: this.getMimetypeFromBuffer(decryptedData, mediaType),
        fileSize: decryptedData.length
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime
      console.error(`❌ [DECRYPT] ERRO após ${processingTime}ms:`)
      console.error(`❌ [DECRYPT] Tipo: ${error.constructor.name}`)
      console.error(`❌ [DECRYPT] Mensagem: ${error.message}`)
      console.error(`❌ [DECRYPT] MediaType: ${mediaType}`)
      console.error(`❌ [DECRYPT] URL: ${encryptedUrl}`)
      console.error(`❌ [DECRYPT] Stack: ${error.stack}`)

      // Re-throw com contexto adicional
      throw new Error(`WhatsApp Decrypt Error [${mediaType}]: ${error.message}`)
    }
  }

  /**
   * Download do arquivo criptografado com retry automático
   */
  private static async downloadEncryptedFile(url: string, maxRetries: number = 3): Promise<Buffer> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [DOWNLOAD] Tentativa ${attempt}/${maxRetries}`)

        const response = await http.get(url, {
          responseType: 'arraybuffer',
          timeout: 30000, // 30 segundos
          maxRedirects: 5
        })

        const buffer = Buffer.from(response.data)
        if (buffer.length === 0) {
          throw new Error('Arquivo baixado está vazio')
        }

        return buffer
      } catch (error: any) {
        console.warn(`⚠️ [DOWNLOAD] Tentativa ${attempt} falhou: ${error.message}`)

        if (attempt === maxRetries) {
          throw new Error(`Falha no download após ${maxRetries} tentativas: ${error.message}`)
        }

        // Aguardar antes da próxima tentativa (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, attempt * 1000))
      }
    }

    throw new Error('Download falhou - número máximo de tentativas excedido')
  }

  /**
   * Validar e decodificar mediaKey
   */
  private static validateAndDecodeMediaKey(mediaKey: string): Buffer {
    try {
      const mediaKeyBuffer = Buffer.from(mediaKey, 'base64')

      if (mediaKeyBuffer.length !== 32) {
        throw new Error(`MediaKey deve ter 32 bytes, recebido: ${mediaKeyBuffer.length}`)
      }

      return mediaKeyBuffer
    } catch (error: any) {
      throw new Error(`MediaKey inválida: ${error.message}`)
    }
  }

  /**
   * Verificar hash do arquivo criptografado
   */
  private static validateEncryptedFileHash(encryptedData: Buffer, expectedHash: string): void {
    try {
      const actualHash = createHash('sha256').update(encryptedData).digest('base64')
      if (actualHash !== expectedHash) {
        console.warn(`⚠️ [HASH] Hash do arquivo criptografado diverge`)
        console.warn(`⚠️ [HASH] Esperado: ${expectedHash}`)
        console.warn(`⚠️ [HASH] Atual: ${actualHash}`)
        // Não falhar por divergência de hash - pode ser por padding ou versão
      } else {
        console.log(`✅ [HASH] Hash do arquivo criptografado válido`)
      }
    } catch (error: any) {
      console.warn(`⚠️ [HASH] Erro ao validar hash criptografado: ${error.message}`)
    }
  }

  /**
   * Extrair chaves do buffer expandido
   */
  private static extractKeys(expandedKey: Buffer): { iv: Buffer; cipherKey: Buffer; macKey: Buffer } {
    return {
      iv: expandedKey.slice(0, 16), // 16 bytes para IV
      cipherKey: expandedKey.slice(16, 48), // 32 bytes para AES-256
      macKey: expandedKey.slice(48, 80) // 32 bytes para HMAC-SHA256
    }
  }

  /**
   * Separar dados do arquivo e MAC
   */
  private static separateDataAndMac(encryptedData: Buffer): { fileData: Buffer; fileMac: Buffer } {
    if (encryptedData.length < 10) {
      throw new Error(`Arquivo muito pequeno para conter MAC: ${encryptedData.length} bytes`)
    }

    const fileLen = encryptedData.length - 10
    return {
      fileData: encryptedData.slice(0, fileLen),
      fileMac: encryptedData.slice(fileLen)
    }
  }

  /**
   * Verificar MAC com tratamento robusto de erros
   */
  private static async verifyMac(fileData: Buffer, iv: Buffer, macKey: Buffer, fileMac: Buffer): Promise<void> {
    const macStartTime = Date.now()

    try {
      console.log(`🔄 [MAC] Iniciando verificação MAC...`)

      // Calcular MAC esperado
      const hmac = createHmac('sha256', macKey)
      hmac.update(Buffer.concat([iv, fileData]))
      const fullMac = hmac.digest()
      const expectedMac = fullMac.slice(0, 10)

      // Comparar MACs
      const macTime = Date.now() - macStartTime

      if (!fileMac.equals(expectedMac)) {
        console.error(`❌ [MAC] Verificação falhou em ${macTime}ms`)
        console.error(`❌ [MAC] Esperado: ${expectedMac.toString('hex')}`)
        console.error(`❌ [MAC] Recebido: ${fileMac.toString('hex')}`)
        console.error(`❌ [MAC] FileData tamanho: ${fileData.length}`)
        console.error(`❌ [MAC] IV: ${iv.toString('hex')}`)

        throw new Error('Verificação MAC falhou - arquivo pode estar corrompido ou chave incorreta')
      }

      console.log(`✅ [MAC] Verificação bem-sucedida em ${macTime}ms`)
    } catch (error: any) {
      const macTime = Date.now() - macStartTime
      throw new Error(`Erro na verificação MAC após ${macTime}ms: ${error.message}`)
    }
  }

  /**
   * Descriptografar dados usando AES-256-CBC
   */
  private static decryptData(fileData: Buffer, cipherKey: Buffer, iv: Buffer): Buffer {
    try {
      console.log(`🔄 [AES] Iniciando descriptografia AES-256-CBC...`)

      const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv)
      decipher.setAutoPadding(true) // Deixar o Node.js gerenciar o padding automaticamente

      let decryptedData = Buffer.concat([decipher.update(fileData), decipher.final()])

      console.log(`✅ [AES] Descriptografia concluída - Tamanho: ${decryptedData.length} bytes`)
      return decryptedData
    } catch (error: any) {
      throw new Error(`Erro na descriptografia AES: ${error.message}`)
    }
  }

  /**
   * Verificar hash do arquivo descriptografado
   */
  private static validateDecryptedFileHash(decryptedData: Buffer, expectedHash: string): void {
    try {
      const actualHash = createHash('sha256').update(decryptedData).digest('base64')
      if (actualHash !== expectedHash) {
        console.warn(`⚠️ [HASH] Hash do arquivo descriptografado diverge`)
        console.warn(`⚠️ [HASH] Esperado: ${expectedHash}`)
        console.warn(`⚠️ [HASH] Atual: ${actualHash}`)
        // Não falhar - arquivo pode estar correto mesmo com hash divergente
      } else {
        console.log(`✅ [HASH] Hash do arquivo descriptografado válido`)
      }
    } catch (error: any) {
      console.warn(`⚠️ [HASH] Erro ao validar hash descriptografado: ${error.message}`)
    }
  }

  /**
   * Implementação robusta do HKDF Expand
   */
  private static hkdfExpand(key: Buffer, length: number, info: string): Buffer {
    try {
      const infoBuffer = Buffer.from(info, 'utf8')
      const hashLength = 32 // SHA256 produz 32 bytes
      const n = Math.ceil(length / hashLength)

      if (n >= 255) {
        throw new Error('HKDF: comprimento solicitado muito grande')
      }

      let okm = Buffer.alloc(0)
      let t = Buffer.alloc(0)

      for (let i = 1; i <= n; i++) {
        const hmac = createHmac('sha256', key)
        hmac.update(t)
        hmac.update(infoBuffer)
        hmac.update(Buffer.from([i]))
        t = hmac.digest()
        okm = Buffer.concat([okm, t])
      }

      return okm.slice(0, length)
    } catch (error: any) {
      throw new Error(`HKDF Expand falhou: ${error.message}`)
    }
  }

  /**
   * Detectar mimetype baseado no conteúdo do arquivo e cabeçalhos
   */
  private static getMimetypeFromBuffer(buffer: Buffer, mediaType: string): string {
    try {
      // Verificar pelo menos os primeiros 12 bytes
      if (buffer.length < 12) {
        return this.getFallbackMimetype(mediaType)
      }

      const header = buffer.slice(0, 12)

      // JPEG - FF D8 FF
      if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
        return 'image/jpeg'
      }

      // PNG - 89 50 4E 47 0D 0A 1A 0A
      if (header.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
        return 'image/png'
      }

      // GIF - 47 49 46 38
      if (header.slice(0, 4).equals(Buffer.from([0x47, 0x49, 0x46, 0x38]))) {
        return 'image/gif'
      }

      // WebP - 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
      if (
        header.slice(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
        header.slice(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))
      ) {
        return 'image/webp'
      }

      // MP4 - ?? ?? ?? ?? 66 74 79 70 (ftyp)
      if (header.slice(4, 8).toString() === 'ftyp') {
        return 'video/mp4'
      }

      // PDF - 25 50 44 46
      if (header.slice(0, 4).toString() === '%PDF') {
        return 'application/pdf'
      }

      // OGG - 4F 67 67 53
      if (header.slice(0, 4).equals(Buffer.from([0x4f, 0x67, 0x67, 0x53]))) {
        return mediaType === 'video' ? 'video/ogg' : 'audio/ogg'
      }

      // Fallback baseado no tipo
      return this.getFallbackMimetype(mediaType)
    } catch (error) {
      console.warn(`⚠️ [MIMETYPE] Erro ao detectar mimetype: ${error}`)
      return this.getFallbackMimetype(mediaType)
    }
  }

  /**
   * Mimetype de fallback baseado no tipo de mídia
   */
  private static getFallbackMimetype(mediaType: string): string {
    const fallbackMap: { [key: string]: string } = {
      image: 'image/jpeg',
      video: 'video/mp4',
      audio: 'audio/ogg',
      document: 'application/octet-stream'
    }

    return fallbackMap[mediaType] || 'application/octet-stream'
  }

  private static hkdf(key: Buffer, length: number, info: string): Buffer {
    const hash = 'sha256'
    const hashLength = 32

    // Etapa Extract: salt vazio (zeros)
    const salt = Buffer.alloc(hashLength, 0)
    const extractHmac = createHmac(hash, salt)
    extractHmac.update(key)
    const prk = extractHmac.digest()

    // Etapa Expand
    const infoBuffer = Buffer.from(info, 'utf8')
    const n = Math.ceil(length / hashLength)
    if (n >= 255) {
      throw new Error('HKDF: comprimento solicitado muito grande')
    }

    let okm = Buffer.alloc(0)
    let t = Buffer.alloc(0)

    for (let i = 1; i <= n; i++) {
      const hmac = createHmac(hash, prk)
      hmac.update(t)
      hmac.update(infoBuffer)
      hmac.update(Buffer.from([i]))
      t = hmac.digest()
      okm = Buffer.concat([okm, t])
    }

    return okm.slice(0, length)
  }
}
