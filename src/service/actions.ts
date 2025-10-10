import express from 'express'
import { sendMessage } from '../kafka/producer'
import { IRequestBody } from '../interfaces/IRequestBody'
import { ITenant } from '../interfaces/ITenant'

type Actions = {
  [key: string]: (req: express.Request, res: express.Response, tenant: ITenant) => void
}

type TTmpTicket = {
  [key: number | string]: {
    createdAt: string
    startedAt: string
  }
}
let tmpTicket = {} as TTmpTicket

//Processa os dados para enviar para os outros serviços
const processData = (data: IRequestBody): IRequestBody => {
  let newData = {} as IRequestBody

  return newData
}

const actions: Actions = {
  TICKET_CREATED: async function (req: express.Request, _: express.Response, tenant: ITenant) {
    let data = req.body as IRequestBody
    tmpTicket[data.ticket.protocol] = {
      createdAt: data.event.date,
      startedAt: ''
    }
    let requestData = processData(data)
    await sendMessage(requestData, tenant)
  }
}

export default actions
