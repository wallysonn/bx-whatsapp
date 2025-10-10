import { Request, Response } from 'express'

export interface IMessageController {
  sendText(req: Request, res: Response): Promise<Response>
  sendImage(req: Request, res: Response): Promise<Response>
  sendVideo(req: Request, res: Response): Promise<Response>
  sendAudio(req: Request, res: Response): Promise<Response>
  sendDocument(req: Request, res: Response): Promise<Response>
  sendLocation(req: Request, res: Response): Promise<Response>
  sendContact(req: Request, res: Response): Promise<Response>
}
