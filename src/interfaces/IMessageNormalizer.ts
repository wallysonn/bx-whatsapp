import { IMessageStatus } from './IMessageStatus'
import { INormalizedMessage } from './INormalizedMessage'

export interface IMessageNormalizer {
  normalize(webhookPayload: any): INormalizedMessage
  normalizeStatusMessage(webhookPayload: any): IMessageStatus
  canHandle(webhookPayload: any): boolean
}
