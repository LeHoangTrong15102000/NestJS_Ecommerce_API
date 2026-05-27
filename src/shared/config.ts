import { z } from 'zod'
import fs from 'fs'
import path from 'path'
import { config } from 'dotenv'

// Load .env file if it exists (CI/production sets env vars directly)
if (fs.existsSync(path.resolve('.env'))) {
  config({ path: '.env' })
}

// Nó gọn hơn rất là nhiều so với class-validator, class-transform
const configSchema = z.object({
  // Application
  PORT: z.coerce.number().int().min(1024).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  ALLOWED_ORIGINS: z.string().optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),

  // JWT Secrets - enforce minimum length for security
  ACCESS_TOKEN_SECRET: z.string().min(16, 'ACCESS_TOKEN_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(1),
  REFRESH_TOKEN_SECRET: z.string().min(16, 'REFRESH_TOKEN_SECRET must be at least 16 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().min(1),

  // Payment
  PAYMENT_API_KEY: z.string().min(1),

  // Admin
  ADMIN_NAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(1),
  ADMIN_EMAIL: z.string().min(1),
  ADMIN_PHONENUMBER: z.string().min(1),

  // OTP
  OTP_EXPIRES_IN: z.string().min(1),

  // Email
  RESEND_API_KEY: z.string().min(1),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.string().min(1),
  GOOGLE_CLIENT_REDIRECT_URI: z.string().min(1),

  // App
  APP_NAME: z.string().min(1),
  PREFIX_STATIC_ENDPOINT: z.string().min(1),

  // S3
  S3_REGION: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
  // VNDATA_REGION: z.string(),
  // VNDATA_ACCESS_KEY_ID: z.string(),
  // VNDATA_SECRET_ACCESS_KEY: z.string(),
  // S3_ENDPOINT: z.string(),
  // VNDATA_CLOUD_STORAGE: z.string(),
  // S3_IMAGE_QUALITY: z.number(),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1),

  // Redis
  // REDIS_HOST: z.string(),
  // REDIS_PORT: z.string(),
  // REDIS_USERNAME: z.string(),
  // REDIS_PASSWORD: z.string(),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Mux
  MUX_TOKEN_ID: z.string().min(1),
  MUX_TOKEN_SECRET: z.string().min(1),
  MUX_WEBHOOK_ENDPOINT: z.string().min(1),
  MUX_SIGNING_SECRET: z.string().min(1),

  // API Gateway
  INTERNAL_API_KEY: z.string().optional(),
  SWAGGER_ENABLED: z
    .string()
    .optional()
    .transform((val) => val !== 'false'),
  API_DEPRECATION_REDIRECT: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
})

const configServer = configSchema.safeParse(process.env)
if (!configServer.success) {
  if (process.env.NODE_ENV === 'test') {
    console.warn('⚠️ Skipping env validation in test environment')
  } else {
    console.error('❌ Invalid environment configuration:')
    console.error(configServer.error.format())
    process.exit(1)
  }
}

const envConfig = configServer.success ? configServer.data : (process.env as unknown as z.infer<typeof configSchema>)

export default envConfig
