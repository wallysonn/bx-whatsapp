export interface IMessageStatus {
  // Dados básicos da mensagem
  messageId: string
  instanceId: string
  connectedPhone: string
  fromMe: boolean
  isGroup: boolean
  timestamp: number
  status: string
}
