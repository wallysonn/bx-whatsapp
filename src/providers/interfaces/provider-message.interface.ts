import { IMessageConfirm } from "./message-confirm.interface";

export interface IProviderMessage {
  sendMessageText: (phone: string, message: string) => Promise<IMessageConfirm>;
  sendMessageImage: (phone: string, image: string) => Promise<IMessageConfirm>;
  sendMessageVideo: (phone: string, video: string) => Promise<IMessageConfirm>;
  sendMessageAudio: (phone: string, audio: string) => Promise<IMessageConfirm>;
  sendMessageFile: (phone: string, file: string) => Promise<IMessageConfirm>;
}
