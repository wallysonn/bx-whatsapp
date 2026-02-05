import { IMessageStatus } from '../interfaces/IMessageStatus'
import { INormalizedMessage } from '../interfaces/INormalizedMessage'
import { ITenant } from '../interfaces/ITenant'
import { NormalizerFactory } from '../normalizers/NormalizerFactory'
import { IProviderConnectionStatus } from '../providers/interfaces/provider-connection-status.interface'

export class MessageNormalizerService {
  static async normalizeWebhookMessage(webhookPayload: any, tenant: ITenant): Promise<INormalizedMessage> {
    try {
      return await NormalizerFactory.normalize(webhookPayload, tenant)
    } catch (error: any) {
      console.error('Erro ao normalizar mensagem:', error)
      throw new Error(`Falha na normalização da mensagem: ${error.message ?? 'Erro desconhecido'}`)
    }
  }

  static normalizeWebhookStatusMessage(webhookPayload: any): IMessageStatus {
    try {
      return NormalizerFactory.normalizeStatusMessage(webhookPayload)
    } catch (error: any) {
      console.error('Erro ao normalizar mensagem:', error)
      throw new Error(`Falha na normalização da mensagem: ${error.message ?? 'Erro desconhecido'}`)
    }
  }

  static normalizeWebhookConnectionStatus(webhookPayload: any): IProviderConnectionStatus {
    try {
      return NormalizerFactory.normalizeConnectionStatus(webhookPayload)
    } catch (error: any) {
      console.error('Erro ao normalizar o status da conexão:', error)
      throw new Error(`Falha ao normalizar o status da conexão: ${error.message ?? 'Erro desconhecido'}`)
    }
  }

  static isValidNormalizedMessage(message: any): message is INormalizedMessage {
    return (
      message &&
      typeof message.messageId === 'string' &&
      typeof message.instanceId === 'string' &&
      message.content &&
      typeof message.content.type === 'string'
    )
  }
}
