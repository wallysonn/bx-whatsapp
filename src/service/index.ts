import express from 'express'
import { connectProducer } from '../kafka/producer'
import { connectConsumer } from '../kafka/consumer'
import { EXPRESS_PORT, VERSION } from '../env'
import middleware from './middleware'
import { webhookRoutes, messageRoutes } from '../routes'

const app = express()
app.use(express.json())

//middleware
app.use(middleware)

// use routes
app.use(webhookRoutes)
app.use(messageRoutes)

// route default
app.use('/', (req: express.Request, res: express.Response) => {
  res.status(200).json({
    API: 'WhatsApp API Gateway',
    DevelopedBy: 'WebDatasoft - https://webdatasoft.com.br',
    version: VERSION
  })
})

app.listen(EXPRESS_PORT, async () => {
  await connectProducer()
  await connectConsumer()
  console.log(`Server is running on port ${EXPRESS_PORT}`)
})
