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
import { Injectable, Logger, UseGuards } from '@nestjs/common'

import { TokenService } from 'src/shared/services/token.service'
import { SharedUserRepository } from 'src/shared/repositories/shared-user.repo'
import { ConversationService } from 'src/routes/conversation/conversation.service'
import { MessageService } from 'src/routes/conversation/message.service'
import { ConversationRepository } from 'src/routes/conversation/conversation.repo'

interface AuthenticatedSocket extends Socket {
  userId: number
  user: {
    id: number
    name: string
    email: string
    avatar?: string
    status?: string
  }
}

// ===== WEBSOCKET EVENT INTERFACES =====

interface JoinConversationData {
  conversationId: string
}

interface SendMessageData {
  conversationId: string
  content?: string
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'LOCATION' | 'CONTACT'
  replyToId?: string
  attachments?: Array<{
    type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
    fileName: string
    fileUrl: string
    fileSize?: number
    mimeType?: string
    thumbnail?: string
    width?: number
    height?: number
    duration?: number
  }>
  tempId?: string // For client-side message deduplication
}

interface TypingData {
  conversationId: string
}

interface MarkAsReadData {
  conversationId: string
  messageId?: string
}

interface ReactToMessageData {
  messageId: string
  emoji: string
}

interface EditMessageData {
  messageId: string
  content: string
}

interface DeleteMessageData {
  messageId: string
  forEveryone?: boolean
}

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

  // In-memory stores (for production, consider using Redis)
  private onlineUsers = new Map<number, Set<string>>() // userId -> Set of socketIds
  private typingUsers = new Map<string, Set<number>>() // conversationId -> Set of userIds
  private userSockets = new Map<string, AuthenticatedSocket>() // socketId -> socket

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
    private readonly conversationRepo: ConversationRepository,
    private readonly tokenService: TokenService,
    private readonly userRepo: SharedUserRepository,
  ) {
    // Cleanup expired typing indicators every 30 seconds
    setInterval(() => this.cleanupTypingIndicators(), 30000)
  }

  // ===== CONNECTION MANAGEMENT =====

  async handleConnection(client: Socket) {
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

      // Track online user
      if (!this.onlineUsers.has(user.id)) {
        this.onlineUsers.set(user.id, new Set())
      }
      this.onlineUsers.get(user.id)!.add(client.id)
      this.userSockets.set(client.id, authSocket)

      // Join user to their personal room for notifications
      await client.join(`user:${user.id}`)

      // Notify user's conversations about online status
      await this.notifyUserOnlineStatus(user.id, true)

      this.logger.log(`User ${user.id} (${user.name}) connected with socket ${client.id}`)

      // Send connection confirmation
      client.emit('connected', {
        userId: user.id,
        message: 'Successfully connected to chat server',
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`)
      client.emit('connection_error', {
        message: 'Authentication failed',
        error: error.message,
      })
      client.disconnect(true)
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      try {
        // Remove from online users
        const userSockets = this.onlineUsers.get(client.userId)
        if (userSockets) {
          userSockets.delete(client.id)
          if (userSockets.size === 0) {
            this.onlineUsers.delete(client.userId)
            // Notify offline status only if no other sockets
            await this.notifyUserOnlineStatus(client.userId, false)
          }
        }

        // Remove from typing indicators
        this.removeUserFromAllTyping(client.userId)

        // Clean up socket reference
        this.userSockets.delete(client.id)

        this.logger.log(`User ${client.userId} disconnected (socket: ${client.id})`)
      } catch (error) {
        this.logger.error(`Disconnect error: ${error.message}`)
      }
    }
  }

  // ===== CONVERSATION EVENTS =====

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ) {
    try {
      // Verify user is member of conversation
      const isMember = await this.conversationService.isUserInConversation(data.conversationId, client.userId)
      if (!isMember) {
        client.emit('error', {
          event: 'join_conversation',
          message: 'Bạn không có quyền tham gia cuộc trò chuyện này',
        })
        return
      }

      // Join conversation room
      await client.join(`conversation:${data.conversationId}`)

      // Notify others that user joined
      client.to(`conversation:${data.conversationId}`).emit('user_joined_conversation', {
        conversationId: data.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      // Send confirmation to user
      client.emit('joined_conversation', {
        conversationId: data.conversationId,
        message: 'Successfully joined conversation',
        timestamp: new Date(),
      })

      this.logger.debug(`User ${client.userId} joined conversation ${data.conversationId}`)
    } catch (error) {
      this.logger.error(`Join conversation error: ${error.message}`)
      client.emit('error', {
        event: 'join_conversation',
        message: 'Không thể tham gia cuộc trò chuyện',
      })
    }
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinConversationData,
  ) {
    try {
      // Leave conversation room
      await client.leave(`conversation:${data.conversationId}`)

      // Remove from typing if present
      this.removeUserFromTyping(data.conversationId, client.userId)

      // Notify others that user left
      client.to(`conversation:${data.conversationId}`).emit('user_left_conversation', {
        conversationId: data.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      client.emit('left_conversation', {
        conversationId: data.conversationId,
        message: 'Left conversation successfully',
        timestamp: new Date(),
      })

      this.logger.debug(`User ${client.userId} left conversation ${data.conversationId}`)
    } catch (error) {
      this.logger.error(`Leave conversation error: ${error.message}`)
      client.emit('error', {
        event: 'leave_conversation',
        message: 'Không thể rời khỏi cuộc trò chuyện',
      })
    }
  }

  // ===== MESSAGE EVENTS =====

  @SubscribeMessage('send_message')
  async handleSendMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: SendMessageData) {
    try {
      // Send message through service
      const message = await this.messageService.sendMessage(client.userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type,
        replyToId: data.replyToId,
        attachments: data.attachments,
      })

      // Remove user from typing
      this.removeUserFromTyping(data.conversationId, client.userId)

      // Emit to conversation members
      this.server.to(`conversation:${data.conversationId}`).emit('new_message', {
        message,
        tempId: data.tempId,
        timestamp: new Date(),
      })

      // Send delivery confirmation to sender
      client.emit('message_sent', {
        message,
        tempId: data.tempId,
        timestamp: new Date(),
      })

      // Send offline notifications
      await this.sendOfflineNotifications(data.conversationId, message, client.userId)

      this.logger.debug(`Message sent by user ${client.userId} in conversation ${data.conversationId}`)
    } catch (error) {
      this.logger.error(`Send message error: ${error.message}`)
      client.emit('message_error', {
        error: error.message,
        tempId: data.tempId,
        timestamp: new Date(),
      })
    }
  }

  @SubscribeMessage('edit_message')
  async handleEditMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: EditMessageData) {
    try {
      const message = await this.messageService.editMessage(data.messageId, client.userId, data.content)

      // Emit to conversation members
      this.server.to(`conversation:${message.conversationId}`).emit('message_edited', {
        message,
        timestamp: new Date(),
      })

      client.emit('message_edit_success', {
        message,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Edit message error: ${error.message}`)
      client.emit('error', {
        event: 'edit_message',
        message: error.message,
      })
    }
  }

  @SubscribeMessage('delete_message')
  async handleDeleteMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: DeleteMessageData) {
    try {
      const message = await this.messageService.deleteMessage(data.messageId, client.userId, data.forEveryone || false)

      // Emit to conversation members
      this.server.to(`conversation:${message.conversationId}`).emit('message_deleted', {
        message,
        forEveryone: data.forEveryone || false,
        timestamp: new Date(),
      })

      client.emit('message_delete_success', {
        message,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Delete message error: ${error.message}`)
      client.emit('error', {
        event: 'delete_message',
        message: error.message,
      })
    }
  }

  // ===== TYPING EVENTS =====

  @SubscribeMessage('typing_start')
  async handleTypingStart(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: TypingData) {
    try {
      // Verify user is member
      const isMember = await this.conversationService.isUserInConversation(data.conversationId, client.userId)
      if (!isMember) return

      // Add user to typing list
      if (!this.typingUsers.has(data.conversationId)) {
        this.typingUsers.set(data.conversationId, new Set())
      }
      this.typingUsers.get(data.conversationId)!.add(client.userId)

      // Update database typing indicator
      await this.conversationRepo.setTypingIndicator(data.conversationId, client.userId)

      // Notify others in conversation (exclude sender)
      client.to(`conversation:${data.conversationId}`).emit('user_typing', {
        conversationId: data.conversationId,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      // Auto-remove after 10 seconds
      setTimeout(() => {
        this.removeUserFromTyping(data.conversationId, client.userId)
      }, 10000)
    } catch (error) {
      this.logger.error(`Typing start error: ${error.message}`)
    }
  }

  @SubscribeMessage('typing_stop')
  handleTypingStop(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: TypingData) {
    try {
      this.removeUserFromTyping(data.conversationId, client.userId)
    } catch (error) {
      this.logger.error(`Typing stop error: ${error.message}`)
    }
  }

  // ===== MESSAGE INTERACTION EVENTS =====

  @SubscribeMessage('mark_as_read')
  async handleMarkAsRead(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: MarkAsReadData) {
    try {
      const result = await this.messageService.markAsRead(data.conversationId, client.userId, data.messageId)

      // Notify conversation members about read receipt (exclude sender)
      client.to(`conversation:${data.conversationId}`).emit('messages_read', {
        conversationId: data.conversationId,
        messageId: data.messageId,
        userId: client.userId,
        user: client.user,
        readAt: new Date(),
        markedCount: result.markedCount,
      })

      client.emit('mark_as_read_success', {
        conversationId: data.conversationId,
        markedCount: result.markedCount,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Mark as read error: ${error.message}`)
      client.emit('error', {
        event: 'mark_as_read',
        message: error.message,
      })
    }
  }

  @SubscribeMessage('react_to_message')
  async handleReactToMessage(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: ReactToMessageData) {
    try {
      const result = await this.messageService.reactToMessage(data.messageId, client.userId, data.emoji)

      // Get message to find conversation
      const message = await this.messageService.getMessageById(data.messageId, client.userId)

      // Emit to conversation members
      this.server.to(`conversation:${message.conversationId}`).emit('message_reaction_updated', {
        messageId: data.messageId,
        action: result.action,
        emoji: data.emoji,
        userId: client.userId,
        user: client.user,
        reaction: result.action === 'added' ? result.reaction : null,
        timestamp: new Date(),
      })

      client.emit('react_to_message_success', {
        messageId: data.messageId,
        action: result.action,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`React to message error: ${error.message}`)
      client.emit('error', {
        event: 'react_to_message',
        message: error.message,
      })
    }
  }

  @SubscribeMessage('remove_reaction')
  async handleRemoveReaction(@ConnectedSocket() client: AuthenticatedSocket, @MessageBody() data: ReactToMessageData) {
    try {
      await this.messageService.removeReaction(data.messageId, client.userId, data.emoji)

      // Get message to find conversation
      const message = await this.messageService.getMessageById(data.messageId, client.userId)

      // Emit to conversation members
      this.server.to(`conversation:${message.conversationId}`).emit('message_reaction_removed', {
        messageId: data.messageId,
        emoji: data.emoji,
        userId: client.userId,
        user: client.user,
        timestamp: new Date(),
      })

      client.emit('remove_reaction_success', {
        messageId: data.messageId,
        emoji: data.emoji,
        timestamp: new Date(),
      })
    } catch (error) {
      this.logger.error(`Remove reaction error: ${error.message}`)
      client.emit('error', {
        event: 'remove_reaction',
        message: error.message,
      })
    }
  }

  // ===== UTILITY METHODS =====

  private removeUserFromTyping(conversationId: string, userId: number) {
    const typingSet = this.typingUsers.get(conversationId)
    if (typingSet && typingSet.has(userId)) {
      typingSet.delete(userId)

      if (typingSet.size === 0) {
        this.typingUsers.delete(conversationId)
      }

      // Remove from database
      this.conversationRepo.removeTypingIndicator(conversationId, userId).catch(() => {})

      // Notify others that user stopped typing
      this.server.to(`conversation:${conversationId}`).emit('user_stopped_typing', {
        conversationId,
        userId,
        timestamp: new Date(),
      })
    }
  }

  private removeUserFromAllTyping(userId: number) {
    this.typingUsers.forEach((typingSet, conversationId) => {
      if (typingSet.has(userId)) {
        this.removeUserFromTyping(conversationId, userId)
      }
    })
  }

  private async notifyUserOnlineStatus(userId: number, isOnline: boolean) {
    try {
      // Get user's conversations
      const conversations = await this.conversationRepo.findUserConversations(userId, {
        page: 1,
        limit: 100, // Reasonable limit for active conversations
      })

      const event = isOnline ? 'user_online' : 'user_offline'
      const eventData = {
        userId,
        timestamp: new Date(),
        ...(isOnline ? {} : { lastSeen: new Date() }),
      }

      // Notify all conversation members
      conversations.data.forEach((conversation) => {
        this.server.to(`conversation:${conversation.id}`).emit(event, {
          ...eventData,
          conversationId: conversation.id,
        })
      })
    } catch (error) {
      this.logger.error(`Notify online status error: ${error.message}`)
    }
  }

  private async sendOfflineNotifications(conversationId: string, message: any, senderId: number) {
    try {
      // Get conversation members
      const conversation = await this.conversationRepo.findById(conversationId)
      if (!conversation) return

      // Find offline members
      const offlineMembers = conversation.members.filter(
        (member) =>
          member.userId !== senderId && member.isActive && !member.isMuted && !this.onlineUsers.has(member.userId),
      )

      // Log for now - integrate with your notification service
      if (offlineMembers.length > 0) {
        this.logger.log(
          `Would send push notification to ${offlineMembers.length} offline users for message: ${message.id}`,
        )

        // TODO: Integrate with push notification service
        // await this.notificationService.sendPushNotification({
        //   userIds: offlineMembers.map(m => m.userId),
        //   title: `New message from ${message.fromUser.name}`,
        //   body: message.content || 'Sent an attachment',
        //   data: {
        //     conversationId,
        //     messageId: message.id,
        //     type: 'new_message',
        //   },
        // })
      }
    } catch (error) {
      this.logger.error(`Send offline notifications error: ${error.message}`)
    }
  }

  private cleanupTypingIndicators() {
    // Clean up expired typing indicators
    this.conversationRepo.cleanupExpiredTypingIndicators().catch(() => {})

    // Clean up in-memory typing users (remove expired ones)
    const now = Date.now()
    this.typingUsers.forEach((typingSet, conversationId) => {
      // Remove users who have been typing for more than 15 seconds
      // This is a fallback cleanup for edge cases
    })
  }

  // ===== PUBLIC METHODS FOR EXTERNAL USE =====

  /**
   * Notify conversation members about updates
   */
  notifyConversationUpdate(conversationId: string, updateType: string, data: any) {
    this.server.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      type: updateType,
      data,
      timestamp: new Date(),
    })
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId: number, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    })
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: number): boolean {
    return this.onlineUsers.has(userId)
  }

  /**
   * Get list of online users
   */
  getOnlineUsers(): number[] {
    return Array.from(this.onlineUsers.keys())
  }

  /**
   * Get online users in specific conversation
   */
  async getOnlineUsersInConversation(conversationId: string): Promise<number[]> {
    try {
      const conversation = await this.conversationRepo.findById(conversationId)
      if (!conversation) return []

      return conversation.members
        .filter((member) => member.isActive && this.onlineUsers.has(member.userId))
        .map((member) => member.userId)
    } catch (error) {
      this.logger.error(`Get online users in conversation error: ${error.message}`)
      return []
    }
  }

  /**
   * Broadcast system message to conversation
   */
  async broadcastSystemMessage(conversationId: string, content: string, fromUserId?: number) {
    try {
      // Create system message in database
      const systemMessage = await this.messageService.sendMessage(fromUserId || 0, {
        conversationId,
        content,
        type: 'TEXT' as const,
      })

      // Broadcast to conversation members
      this.server.to(`conversation:${conversationId}`).emit('new_message', {
        message: systemMessage,
        timestamp: new Date(),
      })

      return systemMessage
    } catch (error) {
      this.logger.error(`Broadcast system message error: ${error.message}`)
      throw error
    }
  }
}
