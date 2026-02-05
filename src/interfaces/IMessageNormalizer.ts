import { IMessageStatus } from './IMessageStatus'
import { INormalizedMessage } from './INormalizedMessage'
import { IProviderConnectionStatus } from '../providers/interfaces/provider-connection-status.interface'
import { IProvider } from './IProvider'
import { ITenant } from './ITenant'

export interface IMessageNormalizer {
  normalize(webhookPayload: any, tenant: ITenant): Promise<INormalizedMessage>
  normalizeStatusMessage(webhookPayload: any): IMessageStatus
  normalizeConnectionStatus(webhookPayload: any): IProviderConnectionStatus
  canHandle(webhookPayload: any): boolean
}
