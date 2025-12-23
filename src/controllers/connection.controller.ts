import { Request, Response } from 'express'
import Controller from './controller.base'

import { IConnectionController } from '../interfaces/IConnectionController'
import { ParamsDictionary } from 'express-serve-static-core'
import { ParsedQs } from 'qs'

export default class ConnectionController extends Controller implements IConnectionController {
  requestQrcode = async (req: Request, res: Response) => {
        throw new Error('Method not implemented.')
    }

}
