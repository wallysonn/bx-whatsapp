import { Kafka, KafkaConfig, logLevel } from 'kafkajs'
import { KAFKA } from '../env'

const kafkaConfig: KafkaConfig = {
  clientId: KAFKA.CLIENT_ID,
  brokers: [`${KAFKA.HOST}:${KAFKA.PORT}`],
  logLevel: logLevel.ERROR,
}

export const kafka = new Kafka(kafkaConfig)
