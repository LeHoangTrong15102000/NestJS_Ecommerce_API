import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable, Logger } from '@nestjs/common'

// Import handlers
import { ChatConnectionHandler, AuthenticatedSocket } from './handlers/chat-connection.handler'
import {
  ChatMessageHandler,
  SendMessageData,
  EditMessageData,
  DeleteMessageData,
} from './handlers/chat-message.handler'
import { ChatTypingHandler, TypingData } from './handlers/chat-typing.handler'
import {
  ChatInteractionHandler,
  JoinConversationData,
  MarkAsReadData,
  ReactToMessageData,
} from './handlers/chat-interaction.handler'

// Import services
import { ChatRedisService } from './services/chat-redis.service'

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class EnhancedChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(EnhancedChatGateway.name)

  constructor(
    private readonly connectionHandler: ChatConnectionHandler,
    private readonly messageHandler: ChatMessageHandler,
    private readonly typingHandler: ChatTypingHandler,
    private readonly interactionHandler: ChatInteractionHandler,
    private readonly redisService: ChatRedisService,
  ) {
    // Cleanup expired typing indicators every 30 seconds
    // Sử dụng void để tránh lỗi Promise return
    setInterval(() => {
      void this.typingHandler.cleanupExpiredTypingIndicators()
    }, 30000)
  }

  // ===== CONNECTION MANAGEMENT =====

  async handleConnection(client: Socket) {
    const authSocket = await this.connectionHandler.handleConnection(client)

    if (authSocket) {
      // Notify user's conversations about online status
      await this.interactionHandler.notifyUserOnlineStatus(this.server, authSocket.userId, true)
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      const userWentOffline = await this.connectionHandler.handleDisconnect(client)

      if (userWentOffline) {
        // Notify offline status only if user completely went offline
        await this.interactionHandler.notifyUserOnlineStatus(this.server, client.userId, false)
      }

      // Remove from typing indicators
      await this.typingHandler.removeUserFromAllTyping(this.server, client.userId)
    }
  }

  // ===== CONVERSATION EVENTS =====

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ) {
    return this.interactionHandler.handleJoinConversation(this.server, client, data)
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ) {
    return this.interactionHandler.handleLeaveConversation(this.server, client, data)
  }

  // ===== MESSAGE EVENTS =====

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: SendMessageData) {
    return this.messageHandler.handleSendMessage(this.server, client, data)
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: EditMessageData) {
    return this.messageHandler.handleEditMessage(this.server, client, data)
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: DeleteMessageData) {
    return this.messageHandler.handleDeleteMessage(this.server, client, data)
  }

  // ===== TYPING EVENTS =====

  @SubscribeMessage('typing_start')
  async handleTypingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: TypingData) {
    return this.typingHandler.handleTypingStart(this.server, client, data)
  }

  @SubscribeMessage('typing_stop')
  async handleTypingStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: TypingData) {
    return this.typingHandler.handleTypingStop(this.server, client, data)
  }

  // ===== MESSAGE INTERACTION EVENTS =====

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: MarkAsReadData) {
    return this.interactionHandler.handleMarkAsRead(this.server, client, data)
  }

  @SubscribeMessage('react_to_message')
  async handleReactToMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: ReactToMessageData) {
    return this.interactionHandler.handleReactToMessage(this.server, client, data)
  }

  @SubscribeMessage('remove_reaction')
  async handleRemoveReaction(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: ReactToMessageData) {
    return this.interactionHandler.handleRemoveReaction(this.server, client, data)
  }

  // ===== PUBLIC METHODS FOR EXTERNAL USE =====

  /**
   * Notify conversation members about updates
   */
  notifyConversationUpdate(conversationId: string, updateType: string, data: Record<string, any>): void {
    return this.interactionHandler.notifyConversationUpdate(this.server, conversationId, updateType, data)
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId: number, event: string, data: Record<string, any>): void {
    return this.interactionHandler.notifyUser(this.server, userId, event, data)
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId: number): Promise<boolean> {
    return this.connectionHandler.isUserOnline(userId)
  }

  /**
   * Get list of online users
   */
  async getOnlineUsers(): Promise<number[]> {
    return this.connectionHandler.getOnlineUsers()
  }

  /**
   * Get online users in specific conversation
   */
  async getOnlineUsersInConversation(conversationId: string): Promise<number[]> {
    try {
      // Get cached conversations or fetch from database
      const onlineUsers = await this.getOnlineUsers()
      // Filter users who are members of this conversation
      // This could be optimized with better caching
      return onlineUsers // Simplified for now
    } catch (error) {
      this.logger.error(`Get online users in conversation error: ${error.message}`)
      return []
    }
  }

  /**
   * Broadcast system message to conversation
   */
  async broadcastSystemMessage(conversationId: string, content: string, fromUserId?: number): Promise<any> {
    return this.interactionHandler.broadcastSystemMessage(this.server, conversationId, content, fromUserId)
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ status: string; redis: boolean }> {
    const redisHealthy = await this.redisService.healthCheck()
    return {
      status: redisHealthy ? 'healthy' : 'degraded',
      redis: redisHealthy,
    }
  }

  /**
   * Graceful shutdown
   */
  async onApplicationShutdown(): Promise<void> {
    this.logger.log('Shutting down chat gateway...')
    await this.redisService.disconnect()
  }
}
