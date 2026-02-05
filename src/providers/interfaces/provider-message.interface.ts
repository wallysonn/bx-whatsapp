import { IMessageConfirm } from './message-confirm.interface'

export interface IProviderMessage {
  sendMessageText: (phone: string, message: string, messageRefId?: string) => Promise<IMessageConfirm>
  sendMessageImage: (phone: string, image: string, caption?: string, messageRefId?: string) => Promise<IMessageConfirm>
  sendMessageVideo: (phone: string, video: string, caption?: string, messageRefId?: string) => Promise<IMessageConfirm>
  sendMessageAudio: (phone: string, audio: string, messageRefId?: string) => Promise<IMessageConfirm>
  sendMessageFile: (phone: string, file: string, caption?: string, messageRefId?: string) => Promise<IMessageConfirm>
}
