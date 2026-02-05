import express from 'express'
import { Router } from 'express'
import WebhookController from '../controllers/webhook.controller'

const router: Router = express.Router()
const webhookController = new WebhookController()

router.get('/webhook/message', webhookController.integrationValidate)
router.post('/webhook/message', webhookController.onReceivedMessage)
router.post('/webhook/message-status', webhookController.onStatusMessage)
router.post('/webhook/connection-status', webhookController.onConnectionStatus)

export default router
