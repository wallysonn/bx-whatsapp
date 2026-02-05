import { IProvider } from '../interfaces/IProvider'
import { IProviderMessage } from './interfaces/provider-message.interface'
import { WabaProvider } from './waba.provider'
import { WapiProvider } from './wapi.provider'

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
    this.registerProvider('wapi', WapiProvider)
    this.registerProvider('waba', WabaProvider)
  }
}

// Inicializa os providers
ProviderFactory.initialize()
