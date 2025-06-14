import z from 'zod'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

config({
  path: '.env',
})
// Kiểm tra coi thử có file .env hay chưa
if (!fs.existsSync(path.resolve('.env'))) {
  console.log('Không tìm thấy file .env')
  process.exit(1)
}

// Nó gọn hơn rất là nhiều so với class-validator, class-transform
const configSchema = z.object({
  DATABASE_URL: z.string(),
  ACCESS_TOKEN_SECRET: z.string(),
  ACCESS_TOKEN_EXPIRES_IN: z.string(),
  REFRESH_TOKEN_SECRET: z.string(),
  REFRESH_TOKEN_EXPIRES_IN: z.string(),
  SECRET_API_KEY: z.string(),
  ADMIN_NAME: z.string(),
  ADMIN_PASSWORD: z.string(),
  ADMIN_EMAIL: z.string(),
  ADMIN_PHONENUMBER: z.string(),
  OTP_EXPIRES_IN: z.string(),
  RESEND_API_KEY: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_REDIRECT_URI: z.string(),
  GOOGLE_CLIENT_REDIRECT_URI: z.string(),
  APP_NAME: z.string(),
  PREFIX_STATIC_ENDPOINT: z.string(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
  S3_BUCKET_NAME: z.string(),
  // VNDATA_REGION: z.string(),
  // VNDATA_ACCESS_KEY_ID: z.string(),
  // VNDATA_SECRET_ACCESS_KEY: z.string(),
  // S3_ENDPOINT: z.string(),
  // VNDATA_CLOUD_STORAGE: z.string(),
  // S3_IMAGE_QUALITY: z.number(),
})

const configServer = configSchema.safeParse(process.env)
if (!configServer.success) {
  console.log('Các giá trị khia báo trong file env không hợp lệ')
  console.error(configServer.error)
  process.exit(1)
}

const envConfig = configServer.data

export default envConfig
