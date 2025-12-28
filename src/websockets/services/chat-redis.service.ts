import { Injectable, Logger } from '@nestjs/common'
import Redis from 'ioredis'
import envConfig from 'src/shared/config'

@Injectable()
export class ChatRedisService {
  private readonly logger = new Logger(ChatRedisService.name)
  private readonly redis: Redis

  // Redis key prefixes
  private readonly KEYS = {
    ONLINE_USERS: 'chat:online_users', // Hash: userId -> JSON of socket IDs
    USER_SOCKETS: 'chat:user_sockets', // Hash: socketId -> JSON of user info
    TYPING_USERS: 'chat:typing', // Hash: conversationId -> JSON of user IDs
    USER_CONVERSATIONS: 'chat:user_conversations', // Set: userId -> conversation IDs
  } as const

  constructor() {
    // Initialize ioredis client with retry strategy
    this.redis = new Redis(envConfig.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
    })

    this.redis.on('connect', () => {
      this.logger.log('Connected to Redis for chat cache')
    })

    this.redis.on('ready', () => {
      this.logger.log('Redis is ready for chat cache')
    })

    this.redis.on('error', (error) => {
      this.logger.error('Redis connection error:', error)
    })

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed')
    })

    this.redis.on('reconnecting', () => {
      this.logger.log('Reconnecting to Redis...')
    })
  }

  // ===== ONLINE USERS MANAGEMENT =====

  /**
   * Thêm user online với socket ID
   */
  async addOnlineUser(userId: number, socketId: string): Promise<void> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`

      // Lấy socket IDs hiện tại của user
      const currentSocketsJson = await this.redis.get(userKey)
      const currentSockets = currentSocketsJson ? JSON.parse(currentSocketsJson) : []

      // Thêm socket ID mới (tránh duplicate)
      if (!currentSockets.includes(socketId)) {
        currentSockets.push(socketId)
      }

      // Update Redis với TTL 1 hour
      await this.redis.setex(userKey, 3600, JSON.stringify(currentSockets))
    } catch (error) {
      this.logger.error(`Error adding online user ${userId}:`, error)
    }
  }

  /**
   * Xóa user offline hoặc remove socket ID
   */
  async removeOnlineUser(userId: number, socketId: string): Promise<boolean> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`

      // Lấy socket IDs hiện tại
      const currentSocketsJson = await this.redis.get(userKey)
      if (!currentSocketsJson) return false

      const currentSockets = JSON.parse(currentSocketsJson)
      const updatedSockets = currentSockets.filter((id: string) => id !== socketId)

      if (updatedSockets.length === 0) {
        // User hoàn toàn offline
        await this.redis.del(userKey)
        return true // User went offline
      } else {
        // User vẫn còn socket connections khác
        await this.redis.setex(userKey, 3600, JSON.stringify(updatedSockets))
        return false // User still online
      }
    } catch (error) {
      this.logger.error(`Error removing online user ${userId}:`, error)
      return false
    }
  }

  /**
   * Kiểm tra user có online không
   */
  async isUserOnline(userId: number): Promise<boolean> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      const exists = await this.redis.exists(userKey)
      return exists === 1
    } catch (error) {
      this.logger.error(`Error checking online status for user ${userId}:`, error)
      return false
    }
  }

  /**
   * Lấy danh sách tất cả users online
   */
  async getOnlineUsers(): Promise<number[]> {
    try {
      const pattern = `${this.KEYS.ONLINE_USERS}:*`
      const keys = await this.redis.keys(pattern)

      return keys
        .map((key) => {
          const userId = key.split(':').pop()
          return parseInt(userId!, 10)
        })
        .filter((id) => !isNaN(id))
    } catch (error) {
      this.logger.error('Error getting online users:', error)
      return []
    }
  }

  /**
   * Lấy socket IDs của user
   */
  async getUserSocketIds(userId: number): Promise<string[]> {
    try {
      const userKey = `${this.KEYS.ONLINE_USERS}:${userId}`
      const socketsJson = await this.redis.get(userKey)
      return socketsJson ? JSON.parse(socketsJson) : []
    } catch (error) {
      this.logger.error(`Error getting socket IDs for user ${userId}:`, error)
      return []
    }
  }

  // ===== SOCKET USER INFO MANAGEMENT =====

  /**
   * Lưu thông tin user cho socket
   */
  async setSocketUser(socketId: string, userInfo: Record<string, any>): Promise<void> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      await this.redis.setex(socketKey, 3600, JSON.stringify(userInfo)) // TTL 1 hour
    } catch (error) {
      this.logger.error(`Error setting socket user info for ${socketId}:`, error)
    }
  }

  /**
   * Lấy thông tin user từ socket ID
   */
  async getSocketUser(socketId: string): Promise<Record<string, any> | null> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      const userInfoJson = await this.redis.get(socketKey)
      return userInfoJson ? JSON.parse(userInfoJson) : null
    } catch (error) {
      this.logger.error(`Error getting socket user info for ${socketId}:`, error)
      return null
    }
  }

  /**
   * Xóa thông tin socket
   */
  async removeSocket(socketId: string): Promise<void> {
    try {
      const socketKey = `${this.KEYS.USER_SOCKETS}:${socketId}`
      await this.redis.del(socketKey)
    } catch (error) {
      this.logger.error(`Error removing socket ${socketId}:`, error)
    }
  }

  // ===== TYPING INDICATORS MANAGEMENT =====

  /**
   * Set user đang typing trong conversation
   */
  async setUserTyping(conversationId: string, userId: number, expiresInSeconds: number = 10): Promise<void> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`

      // Lấy danh sách users đang typing
      const currentTypingJson = await this.redis.get(typingKey)
      const currentTyping = currentTypingJson ? JSON.parse(currentTypingJson) : []

      // Thêm user nếu chưa có
      if (!currentTyping.includes(userId)) {
        currentTyping.push(userId)
      }

      // Update với TTL
      await this.redis.setex(typingKey, expiresInSeconds, JSON.stringify(currentTyping))
    } catch (error) {
      this.logger.error(`Error setting typing for user ${userId} in conversation ${conversationId}:`, error)
    }
  }

  /**
   * Remove user khỏi typing
   */
  async removeUserTyping(conversationId: string, userId: number): Promise<void> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`

      // Lấy danh sách users đang typing
      const currentTypingJson = await this.redis.get(typingKey)
      if (!currentTypingJson) return

      const currentTyping = JSON.parse(currentTypingJson)
      const updatedTyping = currentTyping.filter((id: number) => id !== userId)

      if (updatedTyping.length === 0) {
        // Không ai typing nữa
        await this.redis.del(typingKey)
      } else {
        // Update danh sách
        await this.redis.setex(typingKey, 10, JSON.stringify(updatedTyping))
      }
    } catch (error) {
      this.logger.error(`Error removing typing for user ${userId} in conversation ${conversationId}:`, error)
    }
  }

  /**
   * Lấy danh sách users đang typing trong conversation
   */
  async getTypingUsers(conversationId: string): Promise<number[]> {
    try {
      const typingKey = `${this.KEYS.TYPING_USERS}:${conversationId}`
      const typingJson = await this.redis.get(typingKey)
      return typingJson ? JSON.parse(typingJson) : []
    } catch (error) {
      this.logger.error(`Error getting typing users for conversation ${conversationId}:`, error)
      return []
    }
  }

  /**
   * Remove user khỏi tất cả conversations typing
   */
  async removeUserFromAllTyping(userId: number): Promise<void> {
    try {
      const pattern = `${this.KEYS.TYPING_USERS}:*`
      const keys = await this.redis.keys(pattern)

      for (const key of keys) {
        const conversationId = key.split(':').pop()!
        await this.removeUserTyping(conversationId, userId)
      }
    } catch (error) {
      this.logger.error(`Error removing user ${userId} from all typing:`, error)
    }
  }

  // ===== USER CONVERSATIONS CACHE =====

  /**
   * Cache danh sách conversations của user
   */
  async cacheUserConversations(userId: number, conversationIds: string[]): Promise<void> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`

      if (conversationIds.length === 0) {
        await this.redis.del(userConversationsKey)
        return
      }

      // Store as JSON với TTL 5 phút
      await this.redis.setex(userConversationsKey, 300, JSON.stringify(conversationIds))
    } catch (error) {
      this.logger.error(`Error caching conversations for user ${userId}:`, error)
    }
  }

  /**
   * Lấy cached conversations của user
   */
  async getCachedUserConversations(userId: number): Promise<string[] | null> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`
      const conversationsJson = await this.redis.get(userConversationsKey)
      return conversationsJson ? JSON.parse(conversationsJson) : null
    } catch (error) {
      this.logger.error(`Error getting cached conversations for user ${userId}:`, error)
      return null
    }
  }

  /**
   * Invalidate cache conversations của user
   */
  async invalidateUserConversations(userId: number): Promise<void> {
    try {
      const userConversationsKey = `${this.KEYS.USER_CONVERSATIONS}:${userId}`
      await this.redis.del(userConversationsKey)
    } catch (error) {
      this.logger.error(`Error invalidating conversations cache for user ${userId}:`, error)
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Cleanup expired keys (có thể schedule định kỳ)
   */
  cleanup(): void {
    try {
      // Redis tự động xóa expired keys, nhưng có thể force cleanup nếu cần
      this.logger.debug('Redis cleanup completed')
    } catch (error) {
      this.logger.error('Error during Redis cleanup:', error)
    }
  }

  /**
   * Health check Redis connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.redis.ping()
      return result === 'PONG'
    } catch (error) {
      this.logger.error('Redis health check failed:', error)
      return false
    }
  }

  /**
   * Disconnect Redis (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    try {
      await this.redis.quit()
      this.logger.log('Disconnected from Redis')
    } catch (error) {
      this.logger.error('Error disconnecting from Redis:', error)
    }
  }
}
