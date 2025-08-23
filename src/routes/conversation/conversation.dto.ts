import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

// ===== REQUEST DTOs =====

export const CreateDirectConversationBodySchema = z.object({
  recipientId: z.number().int().positive().describe('ID của người nhận'),
})

export const CreateGroupConversationBodySchema = z.object({
  name: z.string().min(1).max(500).describe('Tên nhóm'),
  description: z.string().max(1000).optional().describe('Mô tả nhóm'),
  memberIds: z.array(z.number().int().positive()).min(1).max(100).describe('Danh sách ID thành viên'),
  avatar: z.string().url().optional().describe('Avatar nhóm'),
})

export const SendMessageBodySchema = z.object({
  conversationId: z.string().cuid().describe('ID cuộc trò chuyện'),
  content: z.string().min(1).max(10000).optional().describe('Nội dung tin nhắn'),
  type: z
    .enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'LOCATION', 'CONTACT'])
    .default('TEXT')
    .describe('Loại tin nhắn'),
  replyToId: z.string().cuid().optional().describe('ID tin nhắn được reply'),
  attachments: z
    .array(
      z.object({
        type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
        fileName: z.string().min(1).max(500),
        fileUrl: z.string().url(),
        fileSize: z.number().int().positive().optional(),
        mimeType: z.string().optional(),
        thumbnail: z.string().url().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        duration: z.number().int().positive().optional(),
      }),
    )
    .max(10)
    .optional()
    .describe('File đính kèm'),
})

export const AddMembersBodySchema = z.object({
  conversationId: z.string().cuid(),
  memberIds: z.array(z.number().int().positive()).min(1).max(50),
})

export const RemoveMemberBodySchema = z.object({
  conversationId: z.cuid(),
  memberId: z.number().int().positive(),
})

export const UpdateConversationBodySchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
  avatar: z.string().url().optional(),
})

export const MarkAsReadBodySchema = z.object({
  conversationId: z.string().cuid(),
  messageId: z.string().cuid().optional(), // Nếu không có thì mark all as read
})

export const ReactToMessageBodySchema = z.object({
  messageId: z.string().cuid(),
  emoji: z.string().min(1).max(10),
})

export const UpdateMemberRoleBodySchema = z.object({
  conversationId: z.string().cuid(),
  memberId: z.number().int().positive(),
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']),
})

// ===== PARAMS DTOs =====

export const ConversationParamsSchema = z.object({
  conversationId: z.string().cuid(),
})

export const MessageParamsSchema = z.object({
  messageId: z.string().cuid(),
})

export const MemberParamsSchema = z.object({
  conversationId: z.string().cuid(),
  memberId: z.string().regex(/^\d+$/).transform(Number),
})

// ===== QUERY DTOs =====

export const GetConversationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(['DIRECT', 'GROUP']).optional(),
  search: z.string().min(1).max(100).optional(),
  isArchived: z.coerce.boolean().optional(),
})

export const GetMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  before: z.string().cuid().optional(), // Cursor-based pagination
  after: z.string().cuid().optional(),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'SYSTEM', 'LOCATION', 'CONTACT']).optional(),
})

export const SearchMessagesQuerySchema = z.object({
  q: z.string().min(1).max(100).describe('Từ khóa tìm kiếm'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'SYSTEM', 'LOCATION', 'CONTACT']).optional(),
  fromUserId: z.coerce.number().int().positive().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})

// ===== RESPONSE DTOs =====

export const UserBasicSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  avatar: z.string().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
})

export const ConversationMemberSchema = z.object({
  id: z.string(),
  userId: z.number(),
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']),
  joinedAt: z.iso.datetime(),
  lastReadAt: z.iso.datetime().nullable(),
  unreadCount: z.number(),
  isActive: z.boolean(),
  isMuted: z.boolean(),
  mutedUntil: z.iso.datetime().nullable(),
  user: UserBasicSchema,
})

export const MessageAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT']),
  fileName: z.string(),
  fileUrl: z.string(),
  fileSize: z.number().nullable(),
  mimeType: z.string().nullable(),
  thumbnail: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  duration: z.number().nullable(),
  createdAt: z.iso.datetime(),
})

export const MessageReactionSchema = z.object({
  id: z.string(),
  emoji: z.string(),
  userId: z.number(),
  user: UserBasicSchema,
  createdAt: z.iso.datetime(),
})

export const MessageReadReceiptSchema = z.object({
  id: z.string(),
  userId: z.number(),
  readAt: z.iso.datetime(),
  user: UserBasicSchema,
})

export const ConversationMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  fromUserId: z.number(),
  content: z.string().nullable(),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'STICKER', 'SYSTEM', 'LOCATION', 'CONTACT']),
  replyToId: z.string().nullable(),
  isEdited: z.boolean(),
  editedAt: z.iso.datetime().nullable(),
  isDeleted: z.boolean(),
  deletedAt: z.iso.datetime().nullable(),
  deletedForEveryone: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  fromUser: UserBasicSchema,
  replyTo: z
    .lazy(() =>
      ConversationMessageSchema.omit({
        replyTo: true,
        replies: true,
        reactions: true,
        readReceipts: true,
      }),
    )
    .nullable(),
  attachments: z.array(MessageAttachmentSchema),
  reactions: z.array(MessageReactionSchema),
  readReceipts: z.array(MessageReadReceiptSchema),
  // Computed fields
  isReadByCurrentUser: z.boolean().optional(),
  readByCount: z.number().optional(),
})

export const ConversationSchema = z.object({
  id: z.string(),
  type: z.enum(['DIRECT', 'GROUP']),
  name: z.string().nullable(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  ownerId: z.number().nullable(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.iso.datetime().nullable(),
  isArchived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  owner: UserBasicSchema.nullable(),
  members: z.array(ConversationMemberSchema),
  // Computed fields for current user
  unreadCount: z.number(),
  isCurrentUserAdmin: z.boolean().optional(),
  currentUserRole: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']).nullable().optional(),
  memberCount: z.number().optional(),
  onlineMembers: z.array(z.number()).optional(),
})

// Schema cho service response (cho phép Date objects)
export const ConversationServiceSchema = z.object({
  id: z.string(),
  type: z.enum(['DIRECT', 'GROUP']),
  name: z.string().nullable(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  ownerId: z.number().nullable(),
  lastMessage: z.string().nullable(),
  lastMessageAt: z.union([z.date(), z.string()]).nullable(),
  isArchived: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  owner: UserBasicSchema.nullable(),
  members: z.array(ConversationMemberSchema),
  // Computed fields for current user
  unreadCount: z.number(),
  isCurrentUserAdmin: z.boolean().optional(),
  currentUserRole: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']).nullable().optional(),
  memberCount: z.number().optional(),
  onlineMembers: z.array(z.number()).optional(),
})

export const ConversationsListSchema = z.object({
  data: z.array(ConversationSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  stats: z
    .object({
      totalUnread: z.number(),
      directCount: z.number(),
      groupCount: z.number(),
      archivedCount: z.number(),
    })
    .optional(),
})

export const MessagesListSchema = z.object({
  data: z.array(ConversationMessageSchema),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
    prevCursor: z.string().nullable(),
  }),
})

export const MessageSearchResultSchema = z.object({
  data: z.array(
    ConversationMessageSchema.extend({
      conversation: ConversationSchema.pick({
        id: true,
        name: true,
        type: true,
        avatar: true,
      }),
      highlights: z.array(z.string()).optional(),
    }),
  ),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }),
  facets: z
    .object({
      byType: z.record(z.number(), z.number()),
      byUser: z.record(z.number(), z.number()),
      byConversation: z.record(z.number(), z.number()),
    })
    .optional(),
})

export const TypingIndicatorSchema = z.object({
  conversationId: z.string(),
  userId: z.number(),
  user: UserBasicSchema,
  startedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
})

// Schema cho response có message
export const MessageResponseSchema = z.object({
  message: z.string(),
  data: z.any().optional(),
})

// ===== Export DTOs =====

export class CreateDirectConversationBodyDTO extends createZodDto(CreateDirectConversationBodySchema) {}
export class CreateGroupConversationBodyDTO extends createZodDto(CreateGroupConversationBodySchema) {}
export class SendMessageBodyDTO extends createZodDto(SendMessageBodySchema) {}
export class AddMembersBodyDTO extends createZodDto(AddMembersBodySchema) {}
export class RemoveMemberBodyDTO extends createZodDto(RemoveMemberBodySchema) {}
export class UpdateConversationBodyDTO extends createZodDto(UpdateConversationBodySchema) {}
export class MarkAsReadBodyDTO extends createZodDto(MarkAsReadBodySchema) {}
export class ReactToMessageBodyDTO extends createZodDto(ReactToMessageBodySchema) {}
export class UpdateMemberRoleBodyDTO extends createZodDto(UpdateMemberRoleBodySchema) {}

export class ConversationParamsDTO extends createZodDto(ConversationParamsSchema) {}
export class MessageParamsDTO extends createZodDto(MessageParamsSchema) {}
export class MemberParamsDTO extends createZodDto(MemberParamsSchema) {}

export class GetConversationsQueryDTO extends createZodDto(GetConversationsQuerySchema) {}
export class GetMessagesQueryDTO extends createZodDto(GetMessagesQuerySchema) {}
export class SearchMessagesQueryDTO extends createZodDto(SearchMessagesQuerySchema) {}

export class ConversationResDTO extends createZodDto(ConversationSchema) {}
export class ConversationServiceResDTO extends createZodDto(ConversationServiceSchema) {}
export class ConversationsListResDTO extends createZodDto(ConversationsListSchema) {}
export class ConversationMessageResDTO extends createZodDto(ConversationMessageSchema) {}
export class MessagesListResDTO extends createZodDto(MessagesListSchema) {}
export class MessageSearchResultResDTO extends createZodDto(MessageSearchResultSchema) {}
export class TypingIndicatorResDTO extends createZodDto(TypingIndicatorSchema) {}
export class MessageResponseDTO extends createZodDto(MessageResponseSchema) {}
