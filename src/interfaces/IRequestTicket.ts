import { IRequestTicketAgent } from './IRequestTicketAgent'

export interface IRequestTicket {
  protocol: string | number
  creationFlow: string
  agent: IRequestTicketAgent
  oldAgent?: IRequestTicketAgent
}
