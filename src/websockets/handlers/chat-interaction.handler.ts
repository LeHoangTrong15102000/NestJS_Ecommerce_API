import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { SharedChatService } from 'src/shared/services/chat.service'
import { AuthenticatedSocket } from './chat-connection.handler'

// ===== INTERACTION EVENT INTERFACES =====

export interface JoinConversationData {
  conversationId: string
}

export interface MarkAsReadData {
  conversationId: string
  messageId?: string
}

export interface ReactToMessageData {
  messageId: string
  emoji: string
}

@Injectable()
export class ChatInteractionHandler {
  private readonly logger = new Logger(ChatInteractionHandler.name)

  constructor(private readonly chatService: SharedChatService) {}

  /**
   * Xử lý join conversation
   */
  async handleJoinConversation(server: Server, client: AuthenticatedSocket, data: JoinConversationData): Promise<void> {
    try {
      // Verify user is member of conversation
      const isMember = await this.chatService.isUserInConversation(data.conversationId, client.userId)
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

  /**
   * Xử lý leave conversation
   */
  async handleLeaveConversation(
    server: Server,
    client: AuthenticatedSocket,
    data: JoinConversationData,
  ): Promise<void> {
    try {
      // Leave conversation room
      await client.leave(`conversation:${data.conversationId}`)

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

  /**
   * Xử lý mark as read
   */
  async handleMarkAsRead(server: Server, client: AuthenticatedSocket, data: MarkAsReadData): Promise<void> {
    try {
      const result = await this.chatService.markAsRead(data.conversationId, client.userId, data.messageId)

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

  /**
   * Xử lý react to message
   */
  async handleReactToMessage(server: Server, client: AuthenticatedSocket, data: ReactToMessageData): Promise<void> {
    try {
      const result = await this.chatService.reactToMessage(data.messageId, client.userId, data.emoji)

      // Get message to find conversation
      const message = await this.chatService.getMessageById(data.messageId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_reaction_updated', {
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

  /**
   * Xử lý remove reaction
   */
  async handleRemoveReaction(server: Server, client: AuthenticatedSocket, data: ReactToMessageData): Promise<void> {
    try {
      await this.chatService.removeReaction(data.messageId, client.userId, data.emoji)

      // Get message to find conversation
      const message = await this.chatService.getMessageById(data.messageId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_reaction_removed', {
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

  /**
   * Notify user online status to conversations
   */
  async notifyUserOnlineStatus(
    server: Server,
    userId: number,
    isOnline: boolean,
    conversationIds?: string[],
  ): Promise<void> {
    try {
      let conversations: string[] = []

      if (conversationIds) {
        conversations = conversationIds
      } else {
        // Get user's conversations
        const userConversations = await this.chatService.getUserConversations(userId, {
          page: 1,
          limit: 100, // Reasonable limit for active conversations
        })
        conversations = userConversations.data.map((c) => c.id)
      }

      const event = isOnline ? 'user_online' : 'user_offline'
      const eventData = {
        userId,
        timestamp: new Date(),
        ...(isOnline ? {} : { lastSeen: new Date() }),
      }

      // Notify all conversation members
      conversations.forEach((conversationId) => {
        server.to(`conversation:${conversationId}`).emit(event, {
          ...eventData,
          conversationId,
        })
      })
    } catch (error) {
      this.logger.error(`Notify online status error: ${error.message}`)
    }
  }

  /**
   * Broadcast system message to conversation
   */
  async broadcastSystemMessage(
    server: Server,
    conversationId: string,
    content: string,
    fromUserId?: number,
  ): Promise<any> {
    try {
      // Create system message in database
      const systemMessage = await this.chatService.sendMessage(fromUserId || 0, {
        conversationId,
        content,
        type: 'TEXT' as const, // Use TEXT for system messages since SYSTEM might not be in the enum
      })

      // Broadcast to conversation members
      server.to(`conversation:${conversationId}`).emit('new_message', {
        message: systemMessage,
        timestamp: new Date(),
      })

      return systemMessage
    } catch (error) {
      this.logger.error(`Broadcast system message error: ${error.message}`)
      throw error
    }
  }

  /**
   * Notify conversation update
   */
  notifyConversationUpdate(
    server: Server,
    conversationId: string,
    updateType: string,
    data: Record<string, any>,
  ): void {
    server.to(`conversation:${conversationId}`).emit('conversation_updated', {
      conversationId,
      type: updateType,
      data,
      timestamp: new Date(),
    })
  }

  /**
   * Send notification to specific user
   */
  notifyUser(server: Server, userId: number, event: string, data: Record<string, any>): void {
    server.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date(),
    })
  }
}
