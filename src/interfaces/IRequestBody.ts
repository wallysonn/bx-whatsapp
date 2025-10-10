import { IRequestTicket } from './IRequestTicket'
import { IRequestContact } from './IRequestContact'
import { IRequestEvent } from './IRequestEvent'
import { ITenant } from './ITenant'
export interface IRequestBody {
  id: number
  event: IRequestEvent
  contact: IRequestContact
  ticket: IRequestTicket
  await_time?: number //tempo de espera em segundos
  duration?: number //duração do atendimento em segundos
  tenant?: ITenant
}
