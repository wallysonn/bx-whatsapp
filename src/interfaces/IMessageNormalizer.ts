import { IMessageStatus } from './IMessageStatus'
import { INormalizedMessage } from './INormalizedMessage'
import { IProviderConnectionStatus } from '../providers/interfaces/provider-connection-status.interface'

export interface IMessageNormalizer {
  normalize(webhookPayload: any): INormalizedMessage
  normalizeStatusMessage(webhookPayload: any): IMessageStatus
  normalizeConnectionStatus(webhookPayload: any): IProviderConnectionStatus
  canHandle(webhookPayload: any): boolean
}
