import { IContactMessage } from './IContactMessage'

export interface INormalizedMessage {
  // Dados básicos da mensagem
  messageId: string
  messageRefId?: string
  forwarded: boolean
  instanceId: string
  connectedPhone: string
  fromMe: boolean
  isGroup: boolean
  timestamp: number

  // Dados do chat/conversa
  chat: {
    id: string
    profilePicture?: string
  }

  // Dados do remetente
  sender: {
    id: string
    name?: string
    profilePicture?: string
    verifiedBizName?: string
  }

  // Conteúdo da mensagem normalizado
  content: {
    type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact' | 'protocol' | 'contacts'
    text?: string
    // ✅ Atualizar suporte a respostas para incluir mensagem normalizada completa
    reply?: {
      messageId: string
      participant: string
      quotedMessage: {
        type: 'text' | 'image' | 'video' | 'audio' | 'document'
        text?: string
        media?: {
          originalUrl?: string
          mimetype?: string
          fileSize?: number
          duration?: number
          dimensions?: { width: number; height: number }
          caption?: string
          filename?: string
          mediaKey?: string
          fileSha256?: string
          fileEncSha256?: string
        }
      }
    }
    media?: {
      duration?: number
      dimensions?: { width: number; height: number }
      thumbnail?: string
      caption?: string
      url?: string
      originalUrl?: string
      s3Key?: string
      s3Bucket?: string
      s3Region?: string
      mimetype: string
      mediaKey?: string
      fileSha256?: string
      fileEncSha256?: string
      filename?: string
      fileSize: number
      urlExpiresAt?: string
      contentType?: string
      uploadedAt?: string
      processed: boolean
      isGif?: boolean
    }
    location?: {
      latitude: number
      longitude: number
      name?: string
      address?: string
      thumbnail?: string
      isLive?: boolean
    }
    protocol?: {
      key: {
        remoteJid: string
        fromMe: boolean
        id: string
      }
      type: number
    }
    contact?: IContactMessage
    contacts?: {
      name: string
      contacts: IContactMessage[]
    }
  }

  // Metadados do provedor
  provider: {
    name: string
    originalPayload: any
  }
}
