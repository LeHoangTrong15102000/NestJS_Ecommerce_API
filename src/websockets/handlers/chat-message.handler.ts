import { Injectable, Logger } from '@nestjs/common'
import { Server } from 'socket.io'
import { SharedChatService } from 'src/shared/services/chat.service'
import { ChatRedisService } from '../services/chat-redis.service'
import { AuthenticatedSocket } from './chat-connection.handler'

// ===== MESSAGE EVENT INTERFACES =====

export interface SendMessageData {
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

export interface EditMessageData {
  messageId: string
  content: string
}

export interface DeleteMessageData {
  messageId: string
  forEveryone?: boolean
}

@Injectable()
export class ChatMessageHandler {
  private readonly logger = new Logger(ChatMessageHandler.name)

  constructor(
    private readonly chatService: SharedChatService,
    private readonly redisService: ChatRedisService,
  ) {}

  /**
   * Xử lý gửi tin nhắn
   */
  async handleSendMessage(server: Server, client: AuthenticatedSocket, data: SendMessageData): Promise<void> {
    try {
      // Send message through service
      const message = await this.chatService.sendMessage(client.userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type,
        replyToId: data.replyToId,
        attachments: data.attachments,
      })

      // Remove user from typing
      await this.redisService.removeUserTyping(data.conversationId, client.userId)

      // Emit to conversation members
      server.to(`conversation:${data.conversationId}`).emit('new_message', {
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
      await this.sendOfflineNotifications(server, data.conversationId, message, client.userId)

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

  /**
   * Xử lý chỉnh sửa tin nhắn
   */
  async handleEditMessage(server: Server, client: AuthenticatedSocket, data: EditMessageData): Promise<void> {
    try {
      const message = await this.chatService.editMessage(data.messageId, client.userId, data.content)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_edited', {
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

  /**
   * Xử lý xóa tin nhắn
   */
  async handleDeleteMessage(server: Server, client: AuthenticatedSocket, data: DeleteMessageData): Promise<void> {
    try {
      const message = await this.chatService.deleteMessage(data.messageId, client.userId, data.forEveryone || false)

      // Emit to conversation members
      server.to(`conversation:${message.conversationId}`).emit('message_deleted', {
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

  /**
   * Gửi thông báo offline (placeholder for notification service)
   */
  private async sendOfflineNotifications(
    server: Server,
    conversationId: string,
    message: Record<string, any>, // Cải thiện type safety
    senderId: number,
  ): Promise<void> {
    try {
      // Get conversation members từ service hoặc cache
      const conversation = await this.chatService.getConversationById(conversationId, senderId)
      if (!conversation) return

      // Find offline members - định nghĩa type rõ ràng
      const offlineMembers: Array<{ userId: number; name: string }> = []
      for (const member of conversation.members) {
        if (member.userId !== senderId && member.isActive && !member.isMuted) {
          const isOnline = await this.redisService.isUserOnline(member.userId)
          if (!isOnline) {
            offlineMembers.push({
              userId: member.userId,
              name: member.user.name,
            })
          }
        }
      }

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
}
