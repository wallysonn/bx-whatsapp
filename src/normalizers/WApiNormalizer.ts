import { IMessageNormalizer } from '../interfaces/IMessageNormalizer'
import { IMessageStatus } from '../interfaces/IMessageStatus'
import { INormalizedMessage } from '../interfaces/INormalizedMessage'

export class WApiNormalizer implements IMessageNormalizer {
  canHandle(webhookPayload: any): boolean {
    return (
      (webhookPayload.event === 'webhookReceived' && webhookPayload.instanceId && webhookPayload.msgContent) ||
      (webhookPayload.event === 'webhookStatus' && webhookPayload.instanceId && webhookPayload.status)
    )
  }

  normalize(payload: any): INormalizedMessage {
    const normalized: INormalizedMessage = {
      messageId: payload.messageId,
      instanceId: payload.instanceId,
      connectedPhone: payload.connectedPhone,
      fromMe: payload.fromMe,
      isGroup: payload.isGroup,
      timestamp: payload.moment * 1000, // converter para milliseconds

      chat: {
        id: payload.chat.id,
        profilePicture: payload.chat.profilePicture
      },

      sender: {
        id: payload.sender.id,
        name: payload.sender.pushName,
        profilePicture: payload.sender.profilePicture,
        verifiedBizName: payload.sender.verifiedBizName
      },

      content: this.normalizeContent(payload.msgContent),

      provider: {
        name: 'wapi',
        originalPayload: payload
      }
    }

    return normalized
  }

  normalizeStatusMessage(payload: any): IMessageStatus {
    return {
      messageId: payload.messageId,
      instanceId: payload.instanceId,
      connectedPhone: payload.connectedPhone,
      fromMe: payload.fromMe,
      isGroup: payload.isGroup,
      timestamp: payload.moment * 1000,
      status: payload.status.toString().toLowerCase()
    }
  }

  private normalizeContent(msgContent: any): INormalizedMessage['content'] {
    console.log('normalizeContent:msgContent', msgContent)

    // Mensagem de texto simples
    if (msgContent.conversation) {
      return {
        type: 'text',
        text: msgContent.conversation
      }
    }

    // ✅ Mensagem de resposta de texto (extendedTextMessage)
    if (msgContent.extendedTextMessage) {
      const extMsg = msgContent.extendedTextMessage
      return this.handleReplyMessage(
        'text',
        {
          text: extMsg.text
        },
        extMsg.contextInfo
      )
    }

    // ✅ Mensagem de resposta de imagem (extendedImageMessage)
    if (msgContent.extendedImageMessage) {
      const extImg = msgContent.extendedImageMessage
      return this.handleReplyMessage(
        'image',
        {
          originalUrl: extImg.url,
          mimetype: extImg.mimetype,
          fileSize: parseInt(extImg.fileLength),
          dimensions: {
            width: extImg.width,
            height: extImg.height
          },
          thumbnail: extImg.jpegThumbnail,
          caption: extImg.caption ?? '',
          mediaKey: extImg.mediaKey,
          fileSha256: extImg.fileSha256,
          fileEncSha256: extImg.fileEncSha256,
          processed: false
        },
        extImg.contextInfo
      )
    }

    // ✅ Mensagem de resposta de vídeo (extendedVideoMessage)
    if (msgContent.extendedVideoMessage) {
      const extVideo = msgContent.extendedVideoMessage
      return this.handleReplyMessage(
        'video',
        {
          originalUrl: extVideo.url,
          mimetype: extVideo.mimetype,
          fileSize: parseInt(extVideo.fileLength),
          duration: extVideo.seconds,
          dimensions: {
            width: extVideo.width,
            height: extVideo.height
          },
          thumbnail: extVideo.jpegThumbnail,
          caption: extVideo.caption ?? '',
          mediaKey: extVideo.mediaKey,
          fileSha256: extVideo.fileSha256,
          fileEncSha256: extVideo.fileEncSha256,
          processed: false,
          isGif: extVideo.gifPlayback || false
        },
        extVideo.contextInfo
      )
    }

    // ✅ Mensagem de resposta de áudio (extendedAudioMessage)
    if (msgContent.extendedAudioMessage) {
      const extAudio = msgContent.extendedAudioMessage
      return this.handleReplyMessage(
        'audio',
        {
          originalUrl: extAudio.url,
          mimetype: extAudio.mimetype,
          caption: extAudio.caption ?? '',
          fileSize: parseInt(extAudio.fileLength),
          duration: extAudio.seconds,
          mediaKey: extAudio.mediaKey,
          fileSha256: extAudio.fileSha256,
          fileEncSha256: extAudio.fileEncSha256,
          processed: false
        },
        extAudio.contextInfo
      )
    }

    // ✅ Mensagem de resposta de documento (extendedDocumentMessage)
    if (msgContent.extendedDocumentMessage) {
      const extDoc = msgContent.extendedDocumentMessage
      return this.handleReplyMessage(
        'document',
        {
          originalUrl: extDoc.url,
          mimetype: extDoc.mimetype,
          filename: extDoc.fileName,
          caption: extDoc.caption ?? '',
          fileSize: parseInt(extDoc.fileLength),
          mediaKey: extDoc.mediaKey,
          fileSha256: extDoc.fileSha256,
          fileEncSha256: extDoc.fileEncSha256,
          processed: false
        },
        extDoc.contextInfo
      )
    }

    // Mensagens normais (não são respostas)
    if (msgContent.imageMessage) {
      const img = msgContent.imageMessage
      return {
        type: 'image',
        media: {
          originalUrl: img.url,
          mimetype: img.mimetype,
          fileSize: parseInt(img.fileLength),
          dimensions: {
            width: img.width,
            height: img.height
          },
          thumbnail: img.jpegThumbnail,
          caption: img.caption ?? '',
          mediaKey: img.mediaKey,
          fileSha256: img.fileSha256,
          fileEncSha256: img.fileEncSha256,
          processed: false
        }
      }
    }

    // Mensagem normal de documento
    if (msgContent.documentMessage || msgContent.documentWithCaptionMessage) {
      let doc = msgContent.documentMessage
      if (msgContent.documentWithCaptionMessage) {
        doc = msgContent.documentWithCaptionMessage.message.documentMessage
      }
      return {
        type: 'document',
        media: {
          originalUrl: doc.url,
          mimetype: doc.mimetype,
          filename: doc.fileName,
          caption: doc.caption ?? '',
          fileSize: parseInt(doc.fileLength),
          mediaKey: doc.mediaKey,
          fileSha256: doc.fileSha256,
          fileEncSha256: doc.fileEncSha256,
          processed: false
        }
      }
    }

    // Mensagem normal de vídeo
    if (msgContent.videoMessage) {
      const video = msgContent.videoMessage
      return {
        type: 'video',
        media: {
          originalUrl: video.url,
          mimetype: video.mimetype,
          fileSize: parseInt(video.fileLength),
          duration: video.seconds,
          caption: video.caption ?? '',
          mediaKey: video.mediaKey,
          thumbnail: video.jpegThumbnail,
          fileSha256: video.fileSha256,
          fileEncSha256: video.fileEncSha256,
          processed: false,
          isGif: video.gifPlayback !== undefined
        }
      }
    }

    // Mensagem normal de áudio
    if (msgContent.audioMessage) {
      const audio = msgContent.audioMessage
      return {
        type: 'audio',
        media: {
          originalUrl: audio.url,
          mimetype: audio.mimetype,
          fileSize: parseInt(audio.fileLength),
          duration: audio.seconds,
          caption: audio.caption ?? '',
          mediaKey: audio.mediaKey,
          fileSha256: audio.fileSha256,
          fileEncSha256: audio.fileEncSha256,
          processed: false
        }
      }
    }

    //mensagem de localização
    if (msgContent.locationMessage || msgContent.liveLocationMessage) {
      const location = msgContent.locationMessage || msgContent.liveLocationMessage
      return {
        type: 'location',
        location: {
          latitude: location.degreesLatitude,
          longitude: location.degreesLongitude,
          address: location.address ?? '',
          name: location.name ?? '',
          thumbnail: location.jpegThumbnail ?? '',
          isLive: msgContent.liveLocationMessage !== undefined
        }
      }
    }

    // Mensagem de contato
    if (msgContent.contactMessage) {
      const contact = msgContent.contactMessage
      return {
        type: 'contact',
        contact: {
          name: contact.displayName ?? '',
          vcard: contact.vcard ?? ''
        }
      }
    }

    // Array de contatos
    if (msgContent.contactsArrayMessage) {
      const contacts = msgContent.contactsArrayMessage
      return {
        type: 'contacts',
        contacts: contacts.contacts?.map((c: any) => ({
          name: c.displayName ?? '',
          vcard: c.vcard ?? ''
        }))
      }
    }

    //protocol message
    if (msgContent.protocolMessage) {
      const protocol = msgContent.protocolMessage
      return {
        type: 'protocol',
        protocol: {
          key: {
            remoteJid: protocol.key.remoteJid ?? '',
            fromMe: protocol.key.fromMe ?? false,
            id: protocol.key.id ?? ''
          },
          type: protocol.type ?? 0
        }
      }
    }

    console.log('Tipo de mensagem não suportado:', msgContent)
    throw new Error('Tipo de mensagem não suportado')
  }

  // ✅ Método auxiliar para lidar com mensagens de resposta
  private handleReplyMessage(
    type: 'text' | 'image' | 'video' | 'audio' | 'document',
    content: any,
    contextInfo?: any
  ): INormalizedMessage['content'] {
    const baseContent = {
      type,
      ...content
    }

    // Se tem contextInfo com quotedMessage, é uma resposta
    if (contextInfo && contextInfo.quotedMessage) {
      return {
        ...baseContent,
        reply: {
          messageId: contextInfo.stanzaId,
          participant: contextInfo.participant,
          quotedMessage: this.normalizeQuotedMessage(contextInfo.quotedMessage)
        }
      }
    }

    return baseContent
  }

  // ✅ Método para normalizar a mensagem citada
  private normalizeQuotedMessage(quotedMessage: any): any {
    console.log('normalizeQuotedMessage:quotedMessage', quotedMessage)

    // Texto simples
    if (quotedMessage.conversation) {
      return {
        type: 'text',
        text: quotedMessage.conversation
      }
    }

    // Imagem citada
    if (quotedMessage.imageMessage) {
      const img = quotedMessage.imageMessage
      return {
        type: 'image',
        media: {
          originalUrl: img.url,
          mimetype: img.mimetype,
          fileSize: parseInt(img.fileLength),
          dimensions: {
            width: img.width,
            height: img.height
          },
          caption: img.caption ?? '',
          mediaKey: img.mediaKey,
          fileSha256: img.fileSha256,
          fileEncSha256: img.fileEncSha256
        }
      }
    }

    // Vídeo citado
    if (quotedMessage.videoMessage) {
      const video = quotedMessage.videoMessage
      return {
        type: 'video',
        media: {
          originalUrl: video.url,
          mimetype: video.mimetype,
          fileSize: parseInt(video.fileLength),
          duration: video.seconds,
          caption: video.caption ?? '',
          mediaKey: video.mediaKey,
          fileSha256: video.fileSha256,
          fileEncSha256: video.fileEncSha256
        }
      }
    }

    // Áudio citado
    if (quotedMessage.audioMessage) {
      const audio = quotedMessage.audioMessage
      return {
        type: 'audio',
        media: {
          originalUrl: audio.url,
          mimetype: audio.mimetype,
          fileSize: parseInt(audio.fileLength),
          duration: audio.seconds,
          mediaKey: audio.mediaKey,
          fileSha256: audio.fileSha256,
          fileEncSha256: audio.fileEncSha256
        }
      }
    }

    // Documento citado
    if (quotedMessage.documentMessage || quotedMessage.documentWithCaptionMessage) {
      const doc = quotedMessage.documentMessage || quotedMessage.documentWithCaptionMessage
      return {
        type: 'document',
        media: {
          originalUrl: doc.url,
          mimetype: doc.mimetype,
          filename: doc.fileName,
          caption: doc.caption ?? '',
          fileSize: parseInt(doc.fileLength),
          mediaKey: doc.mediaKey,
          fileSha256: doc.fileSha256,
          fileEncSha256: doc.fileEncSha256
        }
      }
    }

    return {
      type: 'text',
      text: '[Mensagem citada não suportada]'
    }
  }
}
