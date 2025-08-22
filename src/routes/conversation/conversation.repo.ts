import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/shared/services/prisma.service'
import { Prisma } from '@prisma/client'

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ===== CONVERSATION CRUD =====

  create(data: {
    type: 'DIRECT' | 'GROUP'
    name?: string
    description?: string
    avatar?: string
    ownerId?: number
    memberIds: number[]
  }) {
    return this.prisma.conversation.create({
      data: {
        type: data.type,
        name: data.name,
        description: data.description,
        avatar: data.avatar,
        ownerId: data.ownerId,
        members: {
          create: data.memberIds.map((userId, index) => ({
            userId,
            role: data.type === 'GROUP' && index === 0 ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: this.getConversationInclude(),
    })
  }

  findById(id: string, userId?: number) {
    const where: Prisma.ConversationWhereInput = { id }

    // Nếu có userId, đảm bảo user là thành viên
    if (userId) {
      where.members = {
        some: {
          userId,
          isActive: true,
        },
      }
    }

    return this.prisma.conversation.findFirst({
      where,
      include: this.getConversationInclude(userId),
    })
  }

  async findUserConversations(
    userId: number,
    options: {
      page: number
      limit: number
      type?: 'DIRECT' | 'GROUP'
      search?: string
      isArchived?: boolean
    },
  ) {
    const { page, limit, type, search, isArchived } = options
    const skip = (page - 1) * limit

    const where: Prisma.ConversationWhereInput = {
      members: {
        some: {
          userId,
          isActive: true,
        },
      },
      isArchived: isArchived ?? false,
    }

    if (type) {
      where.type = type
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        {
          members: {
            some: {
              user: {
                OR: [
                  { name: { contains: search, mode: 'insensitive' } },
                  { email: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ]
    }

    const [conversations, total, stats] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: this.getConversationInclude(userId),
        orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
      this.getConversationStats(userId),
    ])

    return {
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    }
  }

  findDirectConversation(userId1: number, userId2: number) {
    return this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        members: {
          every: {
            userId: { in: [userId1, userId2] },
            isActive: true,
          },
        },
        AND: [{ members: { some: { userId: userId1 } } }, { members: { some: { userId: userId2 } } }],
      },
      include: this.getConversationInclude(userId1),
    })
  }

  update(
    id: string,
    data: Partial<{
      name: string
      description: string
      avatar: string
      lastMessage: string
      lastMessageAt: Date
      isArchived: boolean
      ownerId: number
    }>,
  ) {
    return this.prisma.conversation.update({
      where: { id },
      data,
      include: this.getConversationInclude(),
    })
  }

  archive(id: string, isArchived: boolean = true) {
    return this.update(id, { isArchived })
  }

  // ===== MEMBER MANAGEMENT =====

  addMember(conversationId: string, userId: number, role: 'ADMIN' | 'MODERATOR' | 'MEMBER' = 'MEMBER') {
    return this.prisma.conversationMember.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        role,
        isActive: true,
      },
      update: {
        isActive: true,
        role,
        joinedAt: new Date(),
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

  removeMember(conversationId: string, userId: number) {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isActive: false,
      },
    })
  }

  updateMemberRole(conversationId: string, userId: number, role: 'ADMIN' | 'MODERATOR' | 'MEMBER') {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: { role },
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

  updateMemberLastRead(conversationId: string, userId: number, lastReadAt: Date = new Date()) {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        lastReadAt,
        unreadCount: 0,
      },
    })
  }

  incrementUnreadCount(conversationId: string, excludeUserId: number) {
    return this.prisma.conversationMember.updateMany({
      where: {
        conversationId,
        userId: { not: excludeUserId },
        isActive: true,
      },
      data: {
        unreadCount: { increment: 1 },
      },
    })
  }

  resetUnreadCount(conversationId: string, userId: number) {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    })
  }

  muteMember(conversationId: string, userId: number, mutedUntil?: Date) {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isMuted: true,
        mutedUntil,
      },
    })
  }

  unmuteMember(conversationId: string, userId: number) {
    return this.prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      data: {
        isMuted: false,
        mutedUntil: null,
      },
    })
  }

  // ===== UTILITY METHODS =====

  async isUserMember(conversationId: string, userId: number): Promise<boolean> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    })
    return member?.isActive ?? false
  }

  async getUserRole(conversationId: string, userId: number): Promise<'ADMIN' | 'MODERATOR' | 'MEMBER' | null> {
    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    })
    return member?.isActive ? member.role : null
  }

  getConversationMembers(conversationId: string, activeOnly: boolean = true) {
    return this.prisma.conversationMember.findMany({
      where: {
        conversationId,
        ...(activeOnly ? { isActive: true } : {}),
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
      orderBy: [
        { role: 'asc' }, // ADMIN first
        { joinedAt: 'asc' },
      ],
    })
  }

  async getConversationStats(userId: number) {
    const [total, unread, direct, group, archived] = await Promise.all([
      // Total conversations
      this.prisma.conversation.count({
        where: {
          members: {
            some: {
              userId,
              isActive: true,
            },
          },
          isArchived: false,
        },
      }),
      // Total unread messages
      this.prisma.conversationMember.aggregate({
        where: {
          userId,
          isActive: true,
          conversation: {
            isArchived: false,
          },
        },
        _sum: {
          unreadCount: true,
        },
      }),
      // Direct conversations
      this.prisma.conversation.count({
        where: {
          type: 'DIRECT',
          members: {
            some: {
              userId,
              isActive: true,
            },
          },
          isArchived: false,
        },
      }),
      // Group conversations
      this.prisma.conversation.count({
        where: {
          type: 'GROUP',
          members: {
            some: {
              userId,
              isActive: true,
            },
          },
          isArchived: false,
        },
      }),
      // Archived conversations
      this.prisma.conversation.count({
        where: {
          members: {
            some: {
              userId,
              isActive: true,
            },
          },
          isArchived: true,
        },
      }),
    ])

    return {
      totalUnread: unread._sum.unreadCount || 0,
      directCount: direct,
      groupCount: group,
      archivedCount: archived,
    }
  }

  // ===== TYPING INDICATORS =====

  setTypingIndicator(conversationId: string, userId: number) {
    const expiresAt = new Date(Date.now() + 10000) // 10 seconds

    return this.prisma.typingIndicator.upsert({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      create: {
        conversationId,
        userId,
        expiresAt,
      },
      update: {
        startedAt: new Date(),
        expiresAt,
      },
    })
  }

  removeTypingIndicator(conversationId: string, userId: number) {
    return this.prisma.typingIndicator
      .delete({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
      })
      .catch(() => {}) // Ignore errors if not exists
  }

  getTypingIndicators(conversationId: string) {
    return this.prisma.typingIndicator.findMany({
      where: {
        conversationId,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    })
  }

  cleanupExpiredTypingIndicators() {
    return this.prisma.typingIndicator.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    })
  }

  // ===== PRIVATE HELPER METHODS =====

  private getConversationInclude(currentUserId?: number) {
    return {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
          status: true,
        },
      },
      members: {
        where: { isActive: true },
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
        orderBy: [{ role: 'asc' as const }, { joinedAt: 'asc' as const }],
      },
    }
  }
}
