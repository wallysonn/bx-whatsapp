import express from 'express'
import { Router } from 'express'
import WebhookController from '../controllers/webhook.controller'
import ConnectionController from '../controllers/connection.controller'

const router: Router = express.Router()
const connectionController = new ConnectionController()

router.get('/instance/qrcode', connectionController.requestQrcode)

export default router
