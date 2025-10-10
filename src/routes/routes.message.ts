import express from 'express'
import { Router } from 'express'
import MessageController from '../controllers/message.controller'

const router: Router = express.Router()
const messageController = new MessageController()

router.post('/message/send-text', messageController.sendText)
router.post('/message/send-image', messageController.sendImage)
router.post('/message/send-video', messageController.sendVideo)
router.post('/message/send-audio', messageController.sendAudio)
router.post('/message/send-document', messageController.sendDocument)
router.post('/message/send-location', messageController.sendLocation)
router.post('/message/send-contact', messageController.sendContact)

export default router
