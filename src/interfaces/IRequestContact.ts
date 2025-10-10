import { IRequestContactChannel } from './IRequestContactChannel'
export interface IRequestContact {
  id: string //
  name?: string //nome do cliente
  channel: IRequestContactChannel
  ddi?: string //55
  ddd?: string //98
  phone?: string //98988888888
}
