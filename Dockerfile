# Dockerfile cho NestJS API
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Cài đặt pnpm và dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build application
RUN pnpm run build

# Tạo user non-root cho security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

# Chuyển ownership cho user nodejs
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Script để chạy migration và start app
CMD ["sh", "-c", "npx prisma migrate deploy && pnpm run start:prod"] 