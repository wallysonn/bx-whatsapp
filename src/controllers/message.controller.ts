import { Request, Response } from 'express'
import Controller from './controller.base'
import { IMessageController } from '../interfaces/IMessageController'
import {
  ITextMessageRequest,
  IImageMessageRequest,
  IVideoMessageRequest,
  IAudioMessageRequest,
  IDocumentMessageRequest,
  ILocationMessageRequest,
  IContactMessageRequest
} from '../service/provider.service'

export default class MessageController extends Controller implements IMessageController {
  sendText = async (req: Request, res: Response) => {
    try {
      // Cria o messageRequest sem modificar o req original
      const messageRequest: ITextMessageRequest = {
        ...req.body,
        type: 'text'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending text'
      })
    }
  }

  sendImage = async (req: Request, res: Response) => {
    try {
      const messageRequest: IImageMessageRequest = {
        ...req.body,
        type: 'image'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending image'
      })
    }
  }

  sendVideo = async (req: Request, res: Response) => {
    try {
      const messageRequest: IVideoMessageRequest = {
        ...req.body,
        type: 'video'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending video'
      })
    }
  }

  sendAudio = async (req: Request, res: Response) => {
    try {
      const messageRequest: IAudioMessageRequest = {
        ...req.body,
        type: 'audio'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending audio'
      })
    }
  }

  sendDocument = async (req: Request, res: Response) => {
    try {
      const messageRequest: IDocumentMessageRequest = {
        ...req.body,
        type: 'document'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message
      })
    }
  }

  sendLocation = async (req: Request, res: Response) => {
    try {
      const messageRequest: ILocationMessageRequest = {
        ...req.body,
        type: 'location'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending location'
      })
    }
  }

  sendContact = async (req: Request, res: Response) => {
    try {
      const messageRequest: IContactMessageRequest = {
        ...req.body,
        type: 'contact'
      }

      const result = await this.sendMessage(req, messageRequest)

      return res.status(200).json({
        success: true,
        ...result
      })
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error?.message || 'Error sending contact'
      })
    }
  }
}
