import { Request } from 'express'
import { ITenant } from '../interfaces/ITenant'
import { ProviderService, IMessageRequest } from '../service/provider.service'

export default class Controller {
  public getTenant(req: Request): ITenant {
    return (req as any).tenant
  }

  public async sendMessage(req: Request, messageRequest: IMessageRequest) {
    const tenant = this.getTenant(req)
    return await ProviderService.sendMessage(tenant, messageRequest)
  }
}
