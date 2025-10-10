import { kafka } from './config'
import { KAFKA } from '../env'
import type { Producer } from 'kafkajs'
import { ITenant } from '../interfaces/ITenant'

const producer: Producer = kafka.producer()

async function connectProducer() {
  await producer.connect()
}

// Ajustar para aceitar o formato atual do WebhookController
async function sendMessage(type: string, message: any, tenant: ITenant) {
  message.tenant = tenant
  console.log('kafka producer send with tenant', message)

  // Usar messageId como chave ao invés de ticket.protocol
  const key = message.messageId || message.id || 'default'
  const kafkaKey = `WhatApp_${type}_${key}_${tenant.id}`

  await producer.send({
    topic: KAFKA.TOPIC,
    messages: [
      {
        key: kafkaKey,
        value: JSON.stringify({
          eventType: type,
          ...message
        })
      }
    ]
  })
}

export { connectProducer, sendMessage }
