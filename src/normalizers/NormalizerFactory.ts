import { IMessageNormalizer } from '../interfaces/IMessageNormalizer'
import { ITenant } from '../interfaces/ITenant'
import { IProviderConnectionStatus } from '../providers/interfaces/provider-connection-status.interface'
import { WABANormalizer } from './WABANormalizer'
import { WAPINormalizer } from './WAPINormalizer'

export class NormalizerFactory {
  private static normalizers: IMessageNormalizer[] = [new WAPINormalizer(), new WABANormalizer()]

  static getNormalizer(webhookPayload: any): IMessageNormalizer | null {
    return this.normalizers.find(normalizer => normalizer.canHandle(webhookPayload)) || null
  }

  static normalize(webhookPayload: any, tenant: ITenant) {
    const normalizer = this.getNormalizer(webhookPayload)

    if (!normalizer) {
      throw new Error('Nenhum normalizador encontrado para este payload')
    }

    return normalizer.normalize(webhookPayload, tenant)
  }

  static normalizeStatusMessage(webhookPayload: any) {
    const normalizer = this.getNormalizer(webhookPayload)

    if (!normalizer) {
      throw new Error('Nenhum normalizador encontrado para este payload')
    }

    return normalizer.normalizeStatusMessage(webhookPayload)
  }

  static normalizeConnectionStatus(webhookPayload: any): IProviderConnectionStatus {
    const normalizer = this.getNormalizer(webhookPayload)

    if (!normalizer) {
      throw new Error('Nenhum normalizador encontrado para este payload')
    }

    return normalizer.normalizeConnectionStatus(webhookPayload)
  }
}
