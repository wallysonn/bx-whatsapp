import { Request, Response } from 'express'
import Controller from './controller.base'
import { MessageNormalizerService } from '../service/message-normalizer.service'
import { MediaProcessorService } from '../service/media-processor.service'
import { INormalizedMessage } from '../interfaces/INormalizedMessage'
import { sendMessage } from '../kafka/producer'
import { IMessageStatus } from '../interfaces/IMessageStatus'
export default class WebhookController extends Controller {
  private mediaProcessor: MediaProcessorService

  constructor() {
    super()
    this.mediaProcessor = new MediaProcessorService()
  }

  /**
   * -- method GET
   * @param req
   * @param res
   */
  integrationValidate = async (req: Request, res: Response) => {
    const params = req.query as any

    const mode = params['hub.mode'] ?? null
    const token = params['hub.verify_token'] ?? null
    const challenge = params['hub.challenge'] ?? null

    if (mode === 'subscribe') {
      res.status(200).send(challenge)
      return
    }

    res.status(403).send('Forbidden')
  }

  onReceivedMessage = async (req: Request, res: Response) => {
    try {
      let tenant = this.getTenant(req)
      const webhookPayload = req.body

      //hack para whatsapp api oficial
      if (webhookPayload['object'] === 'whatsapp_business_account') {
        if (webhookPayload['entry']?.[0]?.changes?.[0]?.value?.statuses?.[0]?.status) {
          return await this.onStatusMessage(req, res)
        }
      }

      if (!tenant) {
        res.status(403).send('Forbidden')
        return
      }

      // Normalizar a mensagem recebida
      let normalizedMessage: INormalizedMessage = await MessageNormalizerService.normalizeWebhookMessage(
        webhookPayload,
        tenant
      )

      console.log('Mensagem normalizada:', {
        messageId: normalizedMessage.messageId,
        type: normalizedMessage.content.type,
        from: normalizedMessage.sender.name,
        tenant: tenant.name,
        tenantUuid: tenant.uuid
      })

      // Processar mídia se existir (passando o tenant)
      if (this.hasMedia(normalizedMessage)) {
        console.log(`Processando mídia da mensagem para tenant ${tenant.name} (Bucket: ${tenant.uuid})...`)
        // Gerar URL com 24 horas de validade para dar tempo ao outro microsserviço processar
        const mediaResult = await this.mediaProcessor.processMessageMedia(normalizedMessage, tenant, {
          urlExpiresIn: 86400,
          skipOnError: true, // Adicionar esta opção para continuar mesmo com erro MAC
          maxRetries: 1
        })

        if (mediaResult.success) {
          normalizedMessage = mediaResult.message
        } else {
          console.warn(`Erro ao processar mídia (continuando sem mídia): ${mediaResult.error}`)
          // Continuar sem a mídia processada
        }
      }

      // Se for uma mensagem de localização, o processa o thumbnail
      if (normalizedMessage.content.type === 'location') {
        console.log(`Processando thumbnail da localização para tenant ${tenant.name} (Bucket: ${tenant.uuid})...`)
        const thumbnailResult = await this.mediaProcessor.processLocationThumbnail(normalizedMessage, tenant)

        if (thumbnailResult.success) {
          normalizedMessage = thumbnailResult.message
        } else {
          console.warn(`Erro ao processar thumbnail (continuando sem thumbnail): ${thumbnailResult.error}`)
          // Continuar sem o thumbnail processado
        }
      }

      // Processar a mensagem normalizada (enviar para Kafka)
      await this.processNormalizedMessage(normalizedMessage, tenant)

      res.status(200).json({
        status: 'OK',
        messageId: normalizedMessage.messageId,
        type: normalizedMessage.content.type,
        mediaProcessed: this.hasMedia(normalizedMessage),
        tenantBucket: tenant.uuid,
        mediaUrl: normalizedMessage.content.media?.url,
        urlExpiresAt: normalizedMessage.content.media?.urlExpiresAt
      })
    } catch (error: any) {
      console.error('Erro no webhook:', error)
      res.status(400).json({
        status: 'ERROR',
        message: error?.message ?? 'Erro desconhecido'
      })
    }
  }

  onStatusMessage = async (req: Request, res: Response) => {
    const tenant = this.getTenant(req)
    if (!tenant) {
      res.status(403).send('Forbidden')
      return
    }
    const webhookPayload = req.body
    console.log('webhook - onStatusMessage', webhookPayload)
    let normalizedMessage: IMessageStatus = MessageNormalizerService.normalizeWebhookStatusMessage(webhookPayload)
    // Enviar para Kafka
    await sendMessage('status-message', normalizedMessage, tenant)
    res.status(200).json({
      status: 'OK',
      messageId: normalizedMessage.messageId,
      type: normalizedMessage.status,
      tenantBucket: tenant.uuid
    })
  }

  onConnectionStatus = async (req: Request, res: Response) => {
    const payload = req.body
    const tenant = this.getTenant(req)
    if (!tenant) {
      res.status(403).send('Forbidden')
      return
    }

    console.log('webhook - onConnectionStatus', payload)
    console.log('normalizando evento...')
    const normalized = MessageNormalizerService.normalizeWebhookConnectionStatus(payload)
    console.log('normalized', normalized)
    //envia para kafka

    await sendMessage(
      'connection-status',
      {
        id: Date.now(),
        tenant: tenant,
        timestamp: new Date().toISOString(),
        ...normalized
      },
      tenant
    )

    return res.status(200).json(normalized)
  }

  private async processNormalizedMessage(message: INormalizedMessage, tenant: any) {
    // Converter mensagem normalizada para formato Kafka
    const kafkaMessage = this.convertToKafkaFormat(message, tenant)

    // Enviar para Kafka
    await sendMessage('message-received', kafkaMessage, tenant)

    // Log do processamento
    switch (message.content.type) {
      case 'text':
        console.log(`Texto enviado para Kafka: ${message.content.text}`)
        break
      case 'image':
        console.log(
          `Imagem enviada para Kafka: ${message.content.media?.url} (Bucket: ${message.content.media?.s3Bucket}, Expira: ${message.content.media?.urlExpiresAt})`
        )
        break
      case 'video':
        console.log(
          `Vídeo enviado para Kafka: ${message.content.media?.url} (Bucket: ${message.content.media?.s3Bucket}, Expira: ${message.content.media?.urlExpiresAt})`
        )
        break
      case 'audio':
        console.log(
          `Áudio enviado para Kafka: ${message.content.media?.url} (Bucket: ${message.content.media?.s3Bucket}, Expira: ${message.content.media?.urlExpiresAt})`
        )
        break
      case 'document':
        console.log(
          `Documento enviado para Kafka: ${message.content.media?.url} (Bucket: ${message.content.media?.s3Bucket}, Expira: ${message.content.media?.urlExpiresAt})`
        )
        break
      default:
        console.log(`Mensagem tipo ${message.content.type} enviada para Kafka`)
    }
  }

  private hasMedia(message: INormalizedMessage): boolean {
    return (
      message.content.media !== undefined &&
      message.content.media.originalUrl !== undefined &&
      ['image', 'video', 'audio', 'document'].includes(message.content.type)
    )
  }

  private convertToKafkaFormat(message: INormalizedMessage, tenant: any): any {
    return {
      id: Date.now(),
      messageId: message.messageId,
      normalizedMessage: message,
      tenant: tenant,
      timestamp: new Date().toISOString()
    }
  }
}
