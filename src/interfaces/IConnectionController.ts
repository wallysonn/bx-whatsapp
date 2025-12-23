import { Request, Response } from 'express'

export interface IConnectionController {
  requestQrcode(req: Request, res: Response): Promise<Response>
}
