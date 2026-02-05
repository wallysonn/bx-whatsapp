import { AmazonS3Module, S3UploadResult, S3UploadOptions } from '../modules/amazon_s3.module'
import { ThumbnailModule } from '../modules/thumbnail.module'
import { ProfilepicModule } from '../modules/profilepic.module'
import { INormalizedMessage } from '../interfaces/INormalizedMessage'
import { ITenant } from '../interfaces/ITenant'

export interface MediaProcessingResult {
  success: boolean
  message: INormalizedMessage
  s3Result?: S3UploadResult
  error?: string
  processingTimeMs?: number
}

export interface BatchProcessingResult {
  totalMessages: number
  successCount: number
  errorCount: number
  results: MediaProcessingResult[]
  totalProcessingTimeMs: number
}

export class MediaProcessorService {
  private s3Module: AmazonS3Module
  private thumbnailModule: ThumbnailModule
  private profilepicModule: ProfilepicModule

  constructor() {
    this.s3Module = new AmazonS3Module()
    this.thumbnailModule = new ThumbnailModule()
    this.profilepicModule = new ProfilepicModule()
  }

  /**
   * Processa mídia de uma mensagem normalizada com tratamento robusto de erros
   */
  async processMessageMedia(
    message: INormalizedMessage,
    tenant: ITenant,
    options: {
      urlExpiresIn?: number
      skipOnError?: boolean
      maxRetries?: number
    } = {}
  ): Promise<MediaProcessingResult> {
    const startTime = Date.now()
    const { urlExpiresIn = 3600, skipOnError = false, maxRetries = 3 } = options

    try {
      // Validar entrada
      if (!this.hasMedia(message)) {
        console.log(`ℹ️ [PROCESSOR] Mensagem ${message.messageId} não contém mídia - ignorando`)
        return {
          success: true,
          message,
          processingTimeMs: Date.now() - startTime
        }
      }

      const media = message.content.media!
      console.log(`🔄 [PROCESSOR] Processando mídia - MessageID: ${message.messageId}`)
      console.log(`🔄 [PROCESSOR] Tenant: ${tenant.name} (${tenant.uuid})`)
      console.log(`🔄 [PROCESSOR] Tipo: ${message.content.type}`)
      console.log(`🔄 [PROCESSOR] Mimetype: ${media.mimetype}`)

      // Validações básicas
      const validationError = this.validateMediaMessage(message, media)
      if (validationError) {
        if (skipOnError) {
          console.warn(`⚠️ [PROCESSOR] ${validationError} - ignorando devido a skipOnError=true`)
          return {
            success: true,
            message,
            error: validationError,
            processingTimeMs: Date.now() - startTime
          }
        }
        throw new Error(validationError)
      }

      // Preparar opções para upload
      const uploadOptions: S3UploadOptions = {
        urlExpiresIn,
        connectedPhone: message.connectedPhone,
        messageId: message.messageId,
        mediaKey: media.mediaKey,
        fileSha256: media.fileSha256,
        fileEncSha256: media.fileEncSha256,
        filename: media.filename,
        mediaType: this.getMediaTypeFromContentType(message.content.type),
        maxRetries
      }

      // Processar upload
      console.log(`🔄 [PROCESSOR] Iniciando upload para S3...`, message)
      const s3Result = await this.s3Module.uploadMediaFile(media.originalUrl as string, tenant, uploadOptions)

      // Atualizar mensagem com dados do S3
      let updatedMessage = this.updateMessageWithS3Data(message, s3Result)

      // Salva o thumbnail
      if (message.content.media && message.content.media.thumbnail) {
        const thumbnailPath = await this.thumbnailModule.uploadMediaFile(message.content.media.thumbnail, tenant)
        if (updatedMessage.content.media) {
          updatedMessage.content.media.thumbnail = thumbnailPath
        }
      }

      //atualiza as imagens de perfil
      const curDate = new Date().toLocaleDateString('pt-BR').replaceAll('/', '')
      if (message.sender.profilePicture) {
        const profilePicturePath = await this.profilepicModule.uploadMediaFile(
          message.sender.profilePicture,
          message.sender.id + curDate,
          tenant
        )

        if (updatedMessage.sender) {
          updatedMessage.sender.profilePicture = profilePicturePath
        }

        if (message.chat.profilePicture && message.chat.id !== updatedMessage.sender.id) {
          const chatProfilePicturePath = await this.profilepicModule.uploadMediaFile(
            message.chat.profilePicture,
            message.chat.id + curDate,
            tenant
          )
          if (updatedMessage.chat) {
            updatedMessage.chat.profilePicture = chatProfilePicturePath
          }
        }
      }

      const processingTime = Date.now() - startTime
      console.log(`✅ [PROCESSOR] Mídia processada com sucesso em ${processingTime}ms`)
      console.log(`✅ [PROCESSOR] Bucket: ${s3Result.bucket}`)
      console.log(`✅ [PROCESSOR] Key: ${s3Result.key}`)
      console.log(`✅ [PROCESSOR] Tamanho: ${s3Result.fileSize} bytes`)

      return {
        success: true,
        message: updatedMessage,
        s3Result,
        processingTimeMs: processingTime
      }
    } catch (error: any) {
      const processingTime = Date.now() - startTime

      console.error(`❌ [PROCESSOR] ERRO após ${processingTime}ms:`)
      console.error(`❌ [PROCESSOR] MessageID: ${message.messageId}`)
      console.error(`❌ [PROCESSOR] Tenant: ${tenant.name}`)
      console.error(`❌ [PROCESSOR] Erro: ${error.message}`)
      console.error(`❌ [PROCESSOR] Stack: ${error.stack}`)

      if (skipOnError) {
        console.warn(`⚠️ [PROCESSOR] Continuando devido a skipOnError=true`)
        return {
          success: false,
          message, // Retorna mensagem original
          error: error.message,
          processingTimeMs: processingTime
        }
      }

      // Re-throw com contexto melhorado
      throw new Error(`Media Processing Error [${message.messageId}]: ${error.message}`)
    }
  }

  async processLocationThumbnail(message: INormalizedMessage, tenant: ITenant): Promise<MediaProcessingResult> {
    try {
      // Salva o thumbnail
      if (message.content.location && message.content.location.thumbnail) {
        const thumbnailPath = await this.thumbnailModule.uploadMediaFile(message.content.location.thumbnail, tenant)
        if (message.content.location) {
          message.content.location.thumbnail = thumbnailPath
        }
      }

      return {
        success: true,
        message: message
      }
    } catch (error: any) {
      return {
        success: false,
        message
      }
    }
  }

  /**
   * Processa múltiplas mensagens em lote com controle de concorrência
   */
  async processMultipleMessages(
    messages: INormalizedMessage[],
    tenant: ITenant,
    options: {
      urlExpiresIn?: number
      concurrency?: number
      skipOnError?: boolean
      maxRetries?: number
      progressCallback?: (processed: number, total: number) => void
    } = {}
  ): Promise<BatchProcessingResult> {
    const startTime = Date.now()
    const { urlExpiresIn = 3600, concurrency = 5, skipOnError = true, maxRetries = 3, progressCallback } = options

    console.log(`🔄 [BATCH] Iniciando processamento em lote`)
    console.log(`🔄 [BATCH] Total de mensagens: ${messages.length}`)
    console.log(`🔄 [BATCH] Concorrência: ${concurrency}`)
    console.log(`🔄 [BATCH] Tenant: ${tenant.name}`)

    const results: MediaProcessingResult[] = []
    let successCount = 0
    let errorCount = 0

    // Processar em lotes com controle de concorrência
    for (let i = 0; i < messages.length; i += concurrency) {
      const batch = messages.slice(i, i + concurrency)

      const batchPromises = batch.map(message =>
        this.processMessageMedia(message, tenant, {
          urlExpiresIn,
          skipOnError: true, // Sempre skip no batch para não parar o processo
          maxRetries
        })
      )

      try {
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // Contar resultados
        batchResults.forEach(result => {
          if (result.success) {
            successCount++
          } else {
            errorCount++
          }
        })

        // Callback de progresso
        if (progressCallback) {
          progressCallback(results.length, messages.length)
        }

        console.log(
          `✅ [BATCH] Lote processado: ${i + 1}-${Math.min(i + concurrency, messages.length)}/${messages.length}`
        )
      } catch (error: any) {
        console.error(
          `❌ [BATCH] Erro no lote ${i + 1}-${Math.min(i + concurrency, messages.length)}: ${error.message}`
        )

        // Adicionar resultados de erro para este lote
        batch.forEach(message => {
          results.push({
            success: false,
            message,
            error: error.message,
            processingTimeMs: 0
          })
          errorCount++
        })
      }
    }

    const totalProcessingTime = Date.now() - startTime

    console.log(`🎉 [BATCH] Processamento concluído em ${totalProcessingTime}ms`)
    console.log(`🎉 [BATCH] Sucessos: ${successCount}/${messages.length}`)
    console.log(`🎉 [BATCH] Erros: ${errorCount}/${messages.length}`)

    return {
      totalMessages: messages.length,
      successCount,
      errorCount,
      results,
      totalProcessingTimeMs: totalProcessingTime
    }
  }

  /**
   * Gera nova URL assinada para mídia já processada
   */
  async refreshSignedUrl(
    s3Key: string,
    s3Bucket: string,
    expiresIn: number = 3600
  ): Promise<{ signedUrl: string; urlExpiresAt: string }> {
    try {
      console.log(`🔄 [REFRESH] Gerando nova URL assinada - Key: ${s3Key}`)

      const signedUrl = await this.s3Module.generateSignedUrlDirect(s3Bucket, s3Key, expiresIn)
      const urlExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

      console.log(`✅ [REFRESH] Nova URL gerada, expira em: ${urlExpiresAt}`)

      return { signedUrl, urlExpiresAt }
    } catch (error: any) {
      console.error(`❌ [REFRESH] Erro ao gerar URL assinada: ${error.message}`)
      throw new Error(`Falha ao gerar nova URL assinada: ${error.message}`)
    }
  }

  /**
   * Atualiza mensagem com dados do S3
   */
  private updateMessageWithS3Data(message: INormalizedMessage, s3Result: S3UploadResult): INormalizedMessage {
    return {
      ...message,
      content: {
        ...message.content,
        media: {
          ...message.content.media!,
          url: s3Result.signedUrl, // URL assinada para uso imediato
          originalUrl: s3Result.originalUrl, // URL original preservada
          s3Key: s3Result.key, // Chave S3 para futuras operações
          s3Bucket: s3Result.bucket, // Bucket S3
          s3Region: s3Result.region, // Região S3
          urlExpiresAt: s3Result.urlExpiresAt, // Timestamp de expiração
          fileSize: s3Result.fileSize, // Tamanho do arquivo
          contentType: s3Result.contentType, // Content-type detectado
          uploadedAt: s3Result.uploadedAt, // Timestamp do upload
          processed: true // Flag indicando que foi processado
        }
      }
    }
  }

  /**
   * Valida mensagem de mídia
   */
  private validateMediaMessage(message: INormalizedMessage, media: any): string | null {
    if (!media.originalUrl) {
      return `URL original não encontrada para mensagem ${message.messageId}`
    }

    if (!media.mimetype) {
      return `Mimetype não encontrado para mensagem ${message.messageId}`
    }

    if (!AmazonS3Module.isSupportedMediaType(media.mimetype)) {
      return `Tipo de mídia não suportado: ${media.mimetype}`
    }

    // Validar se é uma URL válida
    try {
      new URL(media.originalUrl)
    } catch {
      return `URL inválida: ${media.originalUrl}`
    }

    return null
  }

  /**
   * Verifica se a mensagem contém mídia
   */
  private hasMedia(message: INormalizedMessage): boolean {
    return (
      message.content?.media !== undefined &&
      message.content.media.originalUrl !== undefined &&
      ['image', 'video', 'audio', 'document'].includes(message.content.type)
    )
  }

  /**
   * Converte tipo de conteúdo para tipo de mídia
   */
  private getMediaTypeFromContentType(contentType: string): 'image' | 'video' | 'audio' | 'document' {
    const typeMap: { [key: string]: 'image' | 'video' | 'audio' | 'document' } = {
      image: 'image',
      video: 'video',
      audio: 'audio',
      document: 'document',
      file: 'document'
    }

    return typeMap[contentType] || 'document'
  }

  /**
   * Obtém estatísticas do processamento
   */
  async getProcessingStats(tenant: ITenant): Promise<{
    bucketInfo: {
      bucketName: string
      exists: boolean
      region: string
    }
  }> {
    try {
      const bucketInfo = await this.s3Module.getBucketStats(tenant)

      return {
        bucketInfo
      }
    } catch (error: any) {
      throw new Error(`Erro ao obter estatísticas: ${error.message}`)
    }
  }

  /**
   * Limpar caches (útil para testes)
   */
  clearCaches(): void {
    this.s3Module.clearBucketCache()
    console.log(`🔄 [PROCESSOR] Caches limpos`)
  }
}
