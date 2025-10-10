import { IProvider } from '../interfaces/IProvider'
import { IProviderMessage } from './interfaces/provider-message.interface'
import { WApiProvider } from './wapi.provider'

export class ProviderFactory {
  private static providers: Map<string, any> = new Map()

  // Registra um provider
  static registerProvider(providerName: string, providerClass: any) {
    this.providers.set(providerName, providerClass)
  }

  // Cria uma instância do provider baseado no nome e configurações
  static createProvider(providerConfig: IProvider, ...args: any[]): IProviderMessage {
    const ProviderClass = this.providers.get(providerConfig.name)

    if (!ProviderClass) {
      throw new Error(`Provider ${providerConfig.name} não encontrado`)
    }

    return new ProviderClass(...args)
  }

  // Inicializa os providers disponíveis
  static initialize() {
    this.registerProvider('wapi', WApiProvider)
    // Aqui você pode registrar outros providers no futuro
    // this.registerProvider('telegram', TelegramProvider)
    // this.registerProvider('sms', SMSProvider)
  }
}

// Inicializa os providers
ProviderFactory.initialize()
