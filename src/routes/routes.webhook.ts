import express from 'express'
import { Router } from 'express'
import WebhookController from '../controllers/webhook.controller'

const router: Router = express.Router()
const webhookController = new WebhookController()

router.post('/webhook/message', webhookController.onReceivedMessage)
router.post('/webhook/message-status', webhookController.onStatusMessage)

export default router
