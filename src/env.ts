import dotenv from 'dotenv'

dotenv.config()
export const VERSION = process.env.VERSION || '1.0.0'
export const EXPRESS_PORT = process.env.EXPRESS_PORT || 3002
export const UPLOAD_PATH = process.env.UPLOAD_PATH || '/tmp'
export const KAFKA = {
  HOST: process.env.KAFKA_HOST || 'localhost',
  PORT: process.env.KAFKA_PORT || 9092,
  TOPIC: process.env.KAFKA_TOPIC || 'whatsapp',
  CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'whatsapp',
  GROUP_ID: process.env.KAFKA_GROUP_ID || 'whatsapp'
}
export const AWS_S3 = {
  REGION: process.env.AWS_REGION || 'us-east-1',
  ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || 'your-access-key-id',
  SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || 'your-secret-access-key'
}

export const WABA = {
  ACCESS_TOKEN: process.env.WABA_ACCESS_TOKEN || 'your-waba-access-token',
  API_VERSION: process.env.WABA_API_VERSION || 'v24.0'
}
