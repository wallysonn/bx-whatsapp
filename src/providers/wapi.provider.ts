import { IMessageConfirm } from './interfaces/message-confirm.interface'
import { IProviderMessage } from './interfaces/provider-message.interface'
import { Provider } from './provider'

export class WAPIProvider extends Provider implements IProviderMessage {
  private baseUrl: string
  private instanceId: string
  private token: string

  constructor(instanceId: string, token: string) {
    super()

    this.baseUrl = 'https://api.w-api.app/v1'
    this.instanceId = instanceId
    this.token = token

    //validar instanceId e token
    if (!this.instanceId || !this.token) {
      throw new Error('instanceId e token são obrigatórios')
    }

    this.clientHttp.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
  }

  private getUrlSendMessage(
    messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact'
  ): string {
    return `${this.baseUrl}/message/send-${messageType}?instanceId=${this.instanceId}`
  }

  private messageContainer(container: object, messageRefId?: string) {
    let data = { ...container } as any
    if (messageRefId) {
      data.messageId = messageRefId
    }
    return data
  }

  async sendMessageText(phone: string, message: string, messageRefId?: string): Promise<IMessageConfirm> {
    const { data } = await this.clientHttp.post(
      this.getUrlSendMessage('text'),
      this.messageContainer(
        {
          phone,
          message
        },
        messageRefId
      )
    )
    return {
      messageId: data.messageId ?? '',
      insertedId: data.insertedId ?? '',
      instanceId: data.instanceId ?? this.instanceId
    }
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
