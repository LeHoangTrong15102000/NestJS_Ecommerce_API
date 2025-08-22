import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== MESSAGE CRUD =====

  create(data: {
    conversationId: string
    fromUserId: number
    content?: string | null
    type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'SYSTEM' | 'LOCATION' | 'CONTACT'
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
  }) {
    return this.prisma.conversationMessage.create({
      data: {
        conversationId: data.conversationId,
        fromUserId: data.fromUserId,
        content: data.content,
        type: data.type,
        replyToId: data.replyToId,
        attachments: data.attachments
          ? {
              create: data.attachments,
            }
          : undefined,
      },
      include: this.getMessageInclude(),
    })
  }

  findById(id: string) {
    return this.prisma.conversationMessage.findUnique({
      where: { id },
      include: this.getMessageInclude(),
    })
  }

  async findConversationMessages(
    conversationId: string,
    options: {
      page: number
      limit: number
      before?: string
      after?: string
      type?: string
    },
  ) {
    const { page, limit, before, after, type } = options
    const skip = (page - 1) * limit

    const where: Prisma.ConversationMessageWhereInput = {
      conversationId,
      isDeleted: false,
    }

    // Filter by message type
    if (type) {
      where.type = type as any
    }

    // Cursor-based pagination
    if (before) {
      const beforeMessage = await this.getMessageCreatedAt(before)
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage }
      }
    }
    if (after) {
      const afterMessage = await this.getMessageCreatedAt(after)
      if (afterMessage) {
        where.createdAt = { gt: afterMessage }
      }
    }

    const [messages, total] = await Promise.all([
      this.prisma.conversationMessage.findMany({
        where,
        include: this.getMessageInclude(),
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversationMessage.count({ where }),
    ])

    // Check if there are more messages
    const hasMore =
      (await this.prisma.conversationMessage.count({
        where: {
          ...where,
          createdAt:
            messages.length > 0
              ? {
                  lt: messages[messages.length - 1].createdAt,
                }
              : undefined,
        },
      })) > 0

    // Generate cursors
    const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null
    const prevCursor = messages.length > 0 ? messages[0].id : null

    return {
      data: messages.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore,
        nextCursor,
        prevCursor,
      },
    }
  }

  async searchMessages(
    conversationIds: string[],
    query: string,
    options: {
      page: number
      limit: number
      type?: string
      fromUserId?: number
      dateFrom?: Date
      dateTo?: Date
    },
  ) {
    const { page, limit, type, fromUserId, dateFrom, dateTo } = options
    const skip = (page - 1) * limit

    const where: Prisma.ConversationMessageWhereInput = {
      conversationId: { in: conversationIds },
      isDeleted: false,
      content: {
        contains: query,
        mode: 'insensitive',
      },
    }

    if (type) {
      where.type = type as any
    }

    if (fromUserId) {
      where.fromUserId = fromUserId
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = dateFrom
      if (dateTo) where.createdAt.lte = dateTo
    }

    const [messages, total, facets] = await Promise.all([
      this.prisma.conversationMessage.findMany({
        where,
        include: {
          ...this.getMessageInclude(),
          conversation: {
            select: {
              id: true,
              name: true,
              type: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversationMessage.count({ where }),
      this.getSearchFacets(conversationIds, query),
    ])

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      facets,
    }
  }

  update(
    id: string,
    data: {
      content?: string
      isEdited?: boolean
      editedAt?: Date
      isDeleted?: boolean
      deletedAt?: Date
      deletedForEveryone?: boolean
    },
  ) {
    return this.prisma.conversationMessage.update({
      where: { id },
      data,
      include: this.getMessageInclude(),
    })
  }

  delete(id: string, forEveryone: boolean = false) {
    const updateData: any = {
      isDeleted: true,
      deletedAt: new Date(),
    }

    if (forEveryone) {
      updateData.deletedForEveryone = true
      updateData.content = null // Clear content for everyone
    }

    return this.prisma.conversationMessage.update({
      where: { id },
      data: updateData,
      include: this.getMessageInclude(),
    })
  }

  // ===== MESSAGE REACTIONS =====

  addReaction(messageId: string, userId: number, emoji: string) {
    return this.prisma.messageReaction.upsert({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
      create: {
        messageId,
        userId,
        emoji,
      },
      update: {
        createdAt: new Date(), // Update timestamp
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
    })
  }

  removeReaction(messageId: string, userId: number, emoji: string) {
    return this.prisma.messageReaction.delete({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    })
  }

  getMessageReactions(messageId: string) {
    return this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })
  }

  async getReactionStats(messageId: string) {
    const reactions = await this.prisma.messageReaction.groupBy({
      by: ['emoji'],
      where: { messageId },
      _count: { emoji: true },
    })

    return reactions.reduce(
      (acc, reaction) => {
        acc[reaction.emoji] = reaction._count.emoji
        return acc
      },
      {} as Record<string, number>,
    )
  }

  // ===== READ RECEIPTS =====

  markAsRead(messageId: string, userId: number) {
    return this.prisma.messageReadReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
    })
  }

  async markConversationAsRead(conversationId: string, userId: number, upToMessageId?: string) {
    const whereClause: Prisma.ConversationMessageWhereInput = {
      conversationId,
      fromUserId: { not: userId }, // Don't mark own messages as read
      isDeleted: false,
    }

    if (upToMessageId) {
      const upToMessage = await this.prisma.conversationMessage.findUnique({
        where: { id: upToMessageId },
        select: { createdAt: true },
      })
      if (upToMessage) {
        whereClause.createdAt = { lte: upToMessage.createdAt }
      }
    }

    // Get all unread messages
    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        ...whereClause,
        readReceipts: {
          none: { userId },
        },
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    })

    // Create read receipts for all unread messages
    if (messages.length > 0) {
      await this.prisma.messageReadReceipt.createMany({
        data: messages.map((msg) => ({
          messageId: msg.id,
          userId,
        })),
        skipDuplicates: true,
      })
    }

    return messages.length
  }

  async getReadReceipts(messageId: string) {
    return this.prisma.messageReadReceipt.findMany({
      where: { messageId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            status: true,
          },
        },
      },
      orderBy: { readAt: 'asc' },
    })
  }

  async getReadReceiptStats(messageId: string) {
    const count = await this.prisma.messageReadReceipt.count({
      where: { messageId },
    })

    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          select: {
            _count: {
              select: {
                members: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
      },
    })

    const totalMembers = message?.conversation._count.members || 0
    const authorId = message?.fromUserId

    return {
      readCount: count,
      totalMembers: authorId ? totalMembers - 1 : totalMembers, // Exclude author
      readPercentage: totalMembers > 1 ? (count / (totalMembers - 1)) * 100 : 0,
    }
  }

  // ===== UTILITY METHODS =====

  getLastMessage(conversationId: string) {
    return this.prisma.conversationMessage.findFirst({
      where: {
        conversationId,
        isDeleted: false,
      },
      orderBy: { createdAt: 'desc' },
      include: this.getMessageInclude(),
    })
  }

  getUnreadCount(conversationId: string, userId: number, lastReadAt?: Date) {
    return this.prisma.conversationMessage.count({
      where: {
        conversationId,
        fromUserId: { not: userId },
        createdAt: lastReadAt ? { gt: lastReadAt } : undefined,
        isDeleted: false,
      },
    })
  }

  async isMessageAuthor(messageId: string, userId: number): Promise<boolean> {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      select: { fromUserId: true },
    })
    return message?.fromUserId === userId
  }

  async getMessageStats(conversationId: string) {
    const [total, byType, mediaCount] = await Promise.all([
      this.prisma.conversationMessage.count({
        where: { conversationId, isDeleted: false },
      }),
      this.prisma.conversationMessage.groupBy({
        by: ['type'],
        where: { conversationId, isDeleted: false },
        _count: { type: true },
      }),
      this.prisma.messageAttachment.count({
        where: {
          message: { conversationId },
        },
      }),
    ])

    return {
      total,
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.type
          return acc
        },
        {} as Record<string, number>,
      ),
      mediaCount,
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private async getMessageCreatedAt(messageId: string): Promise<Date | null> {
    const message = await this.prisma.conversationMessage.findUnique({
      where: { id: messageId },
      select: { createdAt: true },
    })
    return message?.createdAt || null
  }

  private async getSearchFacets(conversationIds: string[], query: string) {
    const [byType, byUser, byConversation] = await Promise.all([
      // Facets by message type
      this.prisma.conversationMessage.groupBy({
        by: ['type'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { type: true },
      }),
      // Facets by user
      this.prisma.conversationMessage.groupBy({
        by: ['fromUserId'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { fromUserId: true },
      }),
      // Facets by conversation
      this.prisma.conversationMessage.groupBy({
        by: ['conversationId'],
        where: {
          conversationId: { in: conversationIds },
          content: { contains: query, mode: 'insensitive' },
          isDeleted: false,
        },
        _count: { conversationId: true },
      }),
    ])

    return {
      byType: byType.reduce(
        (acc, item) => {
          acc[item.type] = item._count.type
          return acc
        },
        {} as Record<string, number>,
      ),
      byUser: byUser.reduce(
        (acc, item) => {
          acc[item.fromUserId.toString()] = item._count.fromUserId
          return acc
        },
        {} as Record<string, number>,
      ),
      byConversation: byConversation.reduce(
        (acc, item) => {
          acc[item.conversationId] = item._count.conversationId
          return acc
        },
        {} as Record<string, number>,
      ),
    }
  }

  private getMessageInclude() {
    return {
      fromUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          status: true,
        },
      },
      replyTo: {
        select: {
          id: true,
          content: true,
          type: true,
          fromUserId: true,
          createdAt: true,
          isDeleted: true,
          deletedForEveryone: true,
          fromUser: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
          attachments: {
            select: {
              id: true,
              type: true,
              fileName: true,
              fileUrl: true,
              thumbnail: true,
              width: true,
              height: true,
            },
          },
        },
      },
      attachments: {
        orderBy: { createdAt: 'asc' as const },
      },
      reactions: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      readReceipts: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
              status: true,
            },
          },
        },
        orderBy: { readAt: 'asc' as const },
      },
    }
  }
}
