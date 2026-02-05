import { IProvider } from '../interfaces/IProvider'
import { IProviderMessage } from './interfaces/provider-message.interface'
import { WABAProvider } from './waba.provider'
import { WAPIProvider } from './wapi.provider'

export class ProviderFactory {
  private static providers: Map<string, any> = new Map()

  // Registra um provider
  static registerProvider(providerName: string, providerClass: any) {
    this.providers.set(providerName, providerClass)
  }

  // Cria uma instância do provider baseado no nome e configurações
  static createProvider(providerConfig: IProvider, ...args: any[]): IProviderMessage {
    const ProviderClass = this.providers.get(providerConfig.name)

    console.log('provider config', providerConfig)

    if (!ProviderClass) {
      throw new Error(`Provider ${providerConfig.name} não encontrado`)
    }

    return new ProviderClass(...args)
  }

  // Inicializa os providers disponíveis
  static initialize() {
    this.registerProvider('wapi', WAPIProvider)
    this.registerProvider('waba', WABAProvider)
  }
}

// Inicializa os providers
ProviderFactory.initialize()
