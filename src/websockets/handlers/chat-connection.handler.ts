import { Injectable, Logger } from '@nestjs/common'
import { Socket } from 'socket.io'
import { TokenService } from 'src/shared/services/token.service'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { ChatRedisService } from '../services/chat-redis.service'

export interface AuthenticatedSocket extends Socket {
  userId: number
  user: {
    id: number
    name: string
    email: string
    avatar?: string
    status?: string
  }
}

@Injectable()
export class ChatConnectionHandler {
  private readonly logger = new Logger(ChatConnectionHandler.name)

  constructor(
    private readonly tokenService: TokenService,
    private readonly userRepo: SharedUserRepository,
    private readonly redisService: ChatRedisService,
  ) {}

  /**
   * Xử lý kết nối WebSocket
   */
  async handleConnection(client: Socket): Promise<AuthenticatedSocket | null> {
    try {
      // Extract token from headers or auth
      const token =
        client.handshake.auth.authorization?.split(' ')[1] || client.handshake.headers.authorization?.split(' ')[1]

      if (!token) {
        throw new Error('No authentication token provided')
      }

      // Verify JWT token
      const payload = await this.tokenService.verifyAccessToken(token)

      // Get user info
      const user = await this.userRepo.findUnique({ id: payload.userId })
      if (!user || user.status !== 'ACTIVE') {
        throw new Error('User not found or inactive')
      }

      // Attach user info to socket
      const authSocket = client as AuthenticatedSocket
      authSocket.userId = user.id
      authSocket.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        avatar: user.avatar || undefined,
        status: user.status,
      }

      // Track online user in Redis
      await this.redisService.addOnlineUser(user.id, client.id)
      await this.redisService.setSocketUser(client.id, authSocket.user)

      // Join user to their personal room for notifications
      await client.join(`user:${user.id}`)

      this.logger.log(`User ${user.id} (${user.name}) connected with socket ${client.id}`)

      // Send connection confirmation
      client.emit('connected', {
        userId: user.id,
        message: 'Successfully connected to chat server',
        timestamp: new Date(),
      })

      return authSocket
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`)
      client.emit('connection_error', {
        message: 'Authentication failed',
        error: error.message,
      })
      client.disconnect(true)
      return null
    }
  }

  /**
   * Xử lý ngắt kết nối WebSocket
   */
  async handleDisconnect(client: AuthenticatedSocket): Promise<boolean> {
    if (!client.userId) return false

    try {
      // Remove from online users in Redis
      const userWentOffline = await this.redisService.removeOnlineUser(client.userId, client.id)

      // Remove from typing indicators
      await this.redisService.removeUserFromAllTyping(client.userId)

      // Clean up socket reference
      await this.redisService.removeSocket(client.id)

      this.logger.log(`User ${client.userId} disconnected (socket: ${client.id})`)

      return userWentOffline // True nếu user hoàn toàn offline
    } catch (error) {
      this.logger.error(`Disconnect error: ${error.message}`)
      return false
    }
  }

  /**
   * Kiểm tra user có online không
   */
  async isUserOnline(userId: number): Promise<boolean> {
    return this.redisService.isUserOnline(userId)
  }

  /**
   * Lấy danh sách users online
   */
  async getOnlineUsers(): Promise<number[]> {
    return this.redisService.getOnlineUsers()
  }

  /**
   * Lấy socket IDs của user
   */
  async getUserSocketIds(userId: number): Promise<string[]> {
    return this.redisService.getUserSocketIds(userId)
  }

  /**
   * Lấy thông tin user từ socket ID
   */
  async getSocketUser(socketId: string): Promise<Record<string, any> | null> {
    return this.redisService.getSocketUser(socketId)
  }
}
