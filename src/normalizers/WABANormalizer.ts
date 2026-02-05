import { WabaProvider } from '../providers/waba.provider'
import { IMessageNormalizer } from '../interfaces/IMessageNormalizer'
import { IMessageStatus } from '../interfaces/IMessageStatus'
import { INormalizedMessage } from '../interfaces/INormalizedMessage'
import { IProviderConnectionStatus } from '../providers/interfaces/provider-connection-status.interface'
import { ITenant } from '../interfaces/ITenant'
import { ProviderService } from '../service/provider.service'
import { IChannel } from '../interfaces/IChannel'
import { GeolocationUtils } from '../utils/geolocation'
import { ConvertUtil } from '../utils/convert'

export class WabaNormalizer implements IMessageNormalizer {
  private provider: WabaProvider | null = null

  canHandle(webhookPayload: any): boolean {
    return webhookPayload.object === 'whatsapp_business_account'
  }

  async normalize(payload: any, tenant: ITenant): Promise<INormalizedMessage> {
    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const message = value?.messages?.[0]
    const contact = value?.contacts?.[0]
    const metadata = value?.metadata

    if (!message) {
      // Fallback ou erro caso não haja mensagem (pode ser um status update que caiu aqui erroneamente)
      throw new Error('Payload inválido: Nenhuma mensagem encontrada.')
    }

    const channel = tenant.channels?.find((c: IChannel) => c.platformId === metadata?.phone_number_id) || null

    if (!channel) {
      throw new Error('Payload inválido: Nenhum canal encontrado.')
    }

    this.provider = ProviderService.createProviderInstance(channel) as WabaProvider

    const normalized: INormalizedMessage = {
      messageId: message.id,
      messageRefId: message?.context?.id || null,
      forwarded: message?.context?.forwarded || false,
      instanceId: metadata?.phone_number_id || '',
      connectedPhone: metadata?.display_phone_number?.replace(/\D/g, '') || '',
      fromMe: false, // Mensagens recebidas via webhook são de terceiros
      isGroup: false, // WABA padrão não lida com grupos da mesma forma que o app comum (geralmente)
      timestamp: Number(message.timestamp) * 1000,

      chat: {
        id: message.from,
        profilePicture: '' // Webhook não envia foto do chat/remetente na mensagem
      },

      sender: {
        id: message.from,
        name: contact?.profile?.name || '',
        profilePicture: '',
        verifiedBizName: ''
      },

      content: await this.normalizeContent(message),

      provider: {
        name: 'waba',
        originalPayload: payload
      }
    }

    return normalized
  }

  normalizeStatusMessage(payload: any): IMessageStatus {
    const entry = payload.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value
    const status = value?.statuses?.[0]
    const metadata = value?.metadata

    if (!status) {
      throw new Error('Payload inválido: Nenhum status encontrado.')
    }

    const normalizeStatus = (st: string): string => {
      switch (st) {
        case 'delivered':
          return 'delivery'
        default:
          return st
      }
    }

    return {
      messageId: status.id,
      instanceId: metadata?.phone_number_id || '',
      connectedPhone: metadata?.display_phone_number?.replace(/\D/g, '') || '',
      fromMe: true, // Status updates são geralmente de mensagens enviadas por nós
      isGroup: false,
      timestamp: Number(status.timestamp) * 1000,
      status: normalizeStatus(status.status)
    }
  }

  normalizeConnectionStatus(payload: any): IProviderConnectionStatus {
    // WABA não tem eventos de conexão/desconexão via webhook da mesma forma (é stateless/API)
    // Mas pode haver alertas de conta.
    return {
      status: 'connected',
      instanceId: payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id || '',
      eventMoment: Date.now()
    }
  }

  private async normalizeContent(message: any): Promise<INormalizedMessage['content']> {
    const type = message.type

    //baixa a mídia, se existir
    let mediaData = {} as any
    if (['image', 'video', 'document', 'audio', 'sticker'].includes(type)) {
      const mediaId = message[type]?.id || message[type]?.link
      if (mediaId) {
        const mimeType = message[type]?.mime_type || ''
        const sha256 = message[type]?.sha256 || ''
        const media = (await this.provider?.downloadMedia(mediaId, mimeType, sha256)) || null

        if (media) {
          ;((mediaData.originalUrl = media.filepath || undefined),
            (mediaData.mimetype = media.mimeType || ''),
            (mediaData.fileSize = media.fileSize || 0),
            (mediaData.caption = message[type]?.caption || ''),
            (mediaData.filename = message[type]?.filename || media.filename),
            (mediaData.processed = false))
        }
      }
    }

    if (type === 'text') {
      return {
        type: 'text',
        text: message.text?.body || ''
      }
    }

    if (mediaData.originalUrl) {
      return {
        type: type === 'sticker' ? (message.animated && message.animated === true ? 'video' : 'image') : type,
        media: {
          ...mediaData
        }
      }
    }

    switch (type) {
      case 'location':
        return {
          type: 'location',
          location: {
            latitude: message.location?.latitude,
            longitude: message.location?.longitude,
            name: message.location?.name,
            address: message.location?.address,
            thumbnail: await GeolocationUtils.getThumbnailByCoordinates(
              message.location?.latitude,
              message.location?.longitude
            )
          }
        }

      case 'contacts':
        const contacts = message.contacts || []
        return {
          type: 'contacts',
          contacts: contacts.map((c: any) => ({
            name: c.name?.formatted_name,
            vcard: ConvertUtil.parseToVcard(
              contacts.map((c: any) => ({
                name: c.name?.formatted_name || '',
                phones:
                  c.phones?.map((p: any) => ({
                    phone: p.phone || ''
                  })) || []
              }))
            )
          }))
        }

      case 'interactive':
        // Botões, listas
        const interactive = message.interactive
        if (interactive.type === 'button_reply') {
          return {
            type: 'text',
            text: interactive.button_reply?.title, // O texto do botão clicado
            reply: {
              messageId: message.context?.id,
              participant: message.from,
              quotedMessage: {
                type: 'text',
                text: interactive.button_reply?.id // ID do botão
              }
            }
          }
        }
        if (interactive.type === 'list_reply') {
          return {
            type: 'text',
            text: interactive.list_reply?.title,
            reply: {
              messageId: message.context?.id,
              participant: message.from,
              quotedMessage: {
                type: 'text',
                text: interactive.list_reply?.id
              }
            }
          }
        }
        return {
          type: 'text',
          text: '[Interactive Message]'
        }

      default:
        return {
          type: 'text',
          text: '[Mensagem não suportada]'
        }
    }
  }
}
