import { ITenant } from '../interfaces/ITenant'
import { IChannel } from '../interfaces/IChannel'
import { IProviderMessage } from '../providers/interfaces/provider-message.interface'
import { ProviderFactory } from '../providers/provider.factory'

// Interface base para todas as mensagens
export interface IBaseMessageRequest {
  phone: string
  channelId?: string // ID do canal específico
  providerName?: string // Nome do provider específico
}

// Interfaces específicas para cada tipo de mensagem
export interface ITextMessageRequest extends IBaseMessageRequest {
  type: 'text'
  message: string
}

export interface IImageMessageRequest extends IBaseMessageRequest {
  type: 'image'
  image: string
  caption?: string
}

export interface IVideoMessageRequest extends IBaseMessageRequest {
  type: 'video'
  video: string
  caption?: string
}

export interface IAudioMessageRequest extends IBaseMessageRequest {
  type: 'audio'
  audio: string
}

export interface IDocumentMessageRequest extends IBaseMessageRequest {
  type: 'document'
  document: string
  filename?: string
}

export interface ILocationMessageRequest extends IBaseMessageRequest {
  type: 'location'
  latitude: number
  longitude: number
  address?: string
}

export interface IContactMessageRequest extends IBaseMessageRequest {
  type: 'contact'
  contact: {
    name: string
    phone: string
    email?: string
  }
}

// Union type para todos os tipos de mensagem
export type IMessageRequest =
  | ITextMessageRequest
  | IImageMessageRequest
  | IVideoMessageRequest
  | IAudioMessageRequest
  | IDocumentMessageRequest
  | ILocationMessageRequest
  | IContactMessageRequest

export class ProviderService {
  /**
   * Identifica e retorna o provider correto baseado nas informações da requisição
   */
  static getProviderForMessage(tenant: ITenant, messageRequest: IBaseMessageRequest): IProviderMessage {
    let selectedChannel: IChannel | undefined

    // 1. Se foi especificado um channelId, usa esse canal
    if (messageRequest.channelId) {
      console.log('tenant', tenant)
      console.log('channels for tenant', tenant.channels)
      console.log('messageRequest', messageRequest)

      selectedChannel = tenant.channels?.find(
        channel => channel.identify === messageRequest.channelId && channel.active
      )

      if (!selectedChannel) {
        throw new Error(`Canal ${messageRequest.channelId} não encontrado ou inativo`)
      }
    }
    // 2. Se foi especificado um providerName, busca o primeiro canal ativo com esse provider
    else if (messageRequest.providerName) {
      selectedChannel = tenant.channels?.find(
        channel => channel.provider.name === messageRequest.providerName && channel.active
      )

      if (!selectedChannel) {
        throw new Error(`Nenhum canal ativo encontrado para o provider ${messageRequest.providerName}`)
      }
    }
    // 3. Caso contrário, devolve erro
    else {
      throw new Error('Nenhum canal ativo encontrado para este tenant')
    }

    // Cria e retorna a instância do provider
    return this.createProviderInstance(selectedChannel)
  }

  /**
   * Envia mensagem usando o provider apropriado baseado no tipo
   */
  static async sendMessage(tenant: ITenant, messageRequest: IMessageRequest) {
    const provider = this.getProviderForMessage(tenant, messageRequest)

    switch (messageRequest.type) {
      case 'text':
        return await provider.sendMessageText(messageRequest.phone, messageRequest.message)

      case 'image':
        return await provider.sendMessageImage(messageRequest.phone, messageRequest.image)

      case 'video':
        return await provider.sendMessageVideo(messageRequest.phone, messageRequest.video)

      case 'audio':
        return await provider.sendMessageAudio(messageRequest.phone, messageRequest.audio)

      case 'document':
        return await provider.sendMessageFile(messageRequest.phone, messageRequest.document)

      case 'location':
        // Assumindo que vai implementar sendMessageLocation no provider
        throw new Error('Envio de localização ainda não implementado')

      case 'contact':
        // Assumindo que vai implementar sendMessageContact no provider
        throw new Error('Envio de contato ainda não implementado')

      default:
        throw new Error(`Tipo de mensagem não suportado: ${(messageRequest as any).type}`)
    }
  }


  /**
   * Cria uma instância do provider baseado no canal
   */
  private static createProviderInstance(channel: IChannel): IProviderMessage {
    const provider = channel.provider

    switch (provider.name) {
      case 'wapi':
        const { instanceId, token } = channel.config || {}
        return ProviderFactory.createProvider(provider, instanceId, token)

      default:
        throw new Error(`Provider ${provider.name} não suportado`)
    }
  }
}
