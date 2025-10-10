import { IChannel } from "./IChannel"

export interface ITenant {
  id: number
  uuid: string
  name: string
  active: boolean
  sonax_token?: string
  sonax_id?: number,
  sonax_client_id?: number,
  channels?: IChannel[]
}
