import { IProvider } from './IProvider'

export interface IChannel {
  identify: string // Número do telefone
  platformId: string // ID do canal na plataforma (ex: WABA ID)
  description?: string // Descrição do canal
  active: boolean // Se o canal está ativo
  provider: IProvider // Provider que vai ser usado para enviar a mensagem
  config?: any
}
