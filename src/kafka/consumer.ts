import { kafka } from './config'
import { KAFKA } from '../env'

const consumer = kafka.consumer({
  groupId: KAFKA.GROUP_ID,
  allowAutoTopicCreation: true,
})

async function connectConsumer() {
  await consumer.connect()
  await consumer.subscribe({
    topic: KAFKA.TOPIC,
    fromBeginning: true,
  })
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        // console.log('kafka consumer received', {
        //   partition,
        //   offset: message.offset,
        //   key: message.key?.toString(),
        //   value:
        //     message.value === null
        //       ? null
        //       : JSON.parse(message.value.toString()),
        // })
      } catch (err) {
        console.log('WhatsApp Kafka ERROR', err)
      }
    },
  })
}

export { connectConsumer }
