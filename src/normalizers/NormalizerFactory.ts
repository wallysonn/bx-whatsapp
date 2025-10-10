import { IMessageNormalizer } from '../interfaces/IMessageNormalizer'
import { WApiNormalizer } from './WApiNormalizer'

export class NormalizerFactory {
  private static normalizers: IMessageNormalizer[] = [
    new WApiNormalizer()
    // Adicione outros normalizadores aqui conforme necessário
    // new TelegramNormalizer(),
    // new WhatsAppBusinessNormalizer(),
  ]

  static getNormalizer(webhookPayload: any): IMessageNormalizer | null {
    return this.normalizers.find(normalizer => normalizer.canHandle(webhookPayload)) || null
  }

  static normalize(webhookPayload: any) {
    const normalizer = this.getNormalizer(webhookPayload)

    if (!normalizer) {
      throw new Error('Nenhum normalizador encontrado para este payload')
    }

    return normalizer.normalize(webhookPayload)
  }

  static normalizeStatusMessage(webhookPayload: any) {
    const normalizer = this.getNormalizer(webhookPayload)

    if (!normalizer) {
      throw new Error('Nenhum normalizador encontrado para este payload')
    }

    return normalizer.normalizeStatusMessage(webhookPayload)
  }
}
