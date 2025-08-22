import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodSerializerDto } from 'nestjs-zod'
import { ConversationService } from './conversation.service'
import { MessageService } from './message.service'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { MessageResDTO } from 'src/shared/dtos/response.dto'
import {
  CreateDirectConversationBodyDTO,
  CreateGroupConversationBodyDTO,
  SendMessageBodyDTO,
  AddMembersBodyDTO,
  UpdateConversationBodyDTO,
  MarkAsReadBodyDTO,
  UpdateMemberRoleBodyDTO,
  ConversationParamsDTO,
  MessageParamsDTO,
  MemberParamsDTO,
  GetConversationsQueryDTO,
  GetMessagesQueryDTO,
  SearchMessagesQueryDTO,
  ConversationResDTO,
  ConversationsListResDTO,
  ConversationMessageResDTO,
  MessagesListResDTO,
  MessageSearchResultResDTO,
} from './conversation.dto'

@Controller('conversations')
export class ConversationController {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageService: MessageService,
  ) {}

  // ===== CONVERSATION MANAGEMENT =====

  @Get()
  @ZodSerializerDto(ConversationsListResDTO)
  async getConversations(@ActiveUser('userId') userId: number, @Query() query: GetConversationsQueryDTO) {
    return this.conversationService.getUserConversations(userId, query)
  }

  @Get('stats')
  @ZodSerializerDto(MessageResDTO)
  async getConversationStats(@ActiveUser('userId') userId: number) {
    const stats = await this.conversationService.getConversationStats(userId)
    return { data: stats }
  }

  @Get(':conversationId')
  @ZodSerializerDto(ConversationResDTO)
  async getConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.getConversationById(params.conversationId, userId)
  }

  @Post('direct')
  @ZodSerializerDto(ConversationResDTO)
  async createDirectConversation(@ActiveUser('userId') userId: number, @Body() body: CreateDirectConversationBodyDTO) {
    return this.conversationService.createDirectConversation(userId, body.recipientId)
  }

  @Post('group')
  @ZodSerializerDto(ConversationResDTO)
  async createGroupConversation(@ActiveUser('userId') userId: number, @Body() body: CreateGroupConversationBodyDTO) {
    return this.conversationService.createGroupConversation(userId, body)
  }

  @Put(':conversationId')
  @ZodSerializerDto(ConversationResDTO)
  async updateConversation(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: UpdateConversationBodyDTO,
  ) {
    return this.conversationService.updateConversation(params.conversationId, userId, body)
  }

  @Post(':conversationId/archive')
  @ZodSerializerDto(MessageResDTO)
  async archiveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.archiveConversation(params.conversationId, userId)
  }

  @Post(':conversationId/unarchive')
  @ZodSerializerDto(MessageResDTO)
  async unarchiveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.unarchiveConversation(params.conversationId, userId)
  }

  @Post(':conversationId/mute')
  @ZodSerializerDto(MessageResDTO)
  async muteConversation(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: { mutedUntil?: string },
  ) {
    const mutedUntil = body.mutedUntil ? new Date(body.mutedUntil) : undefined
    return this.conversationService.muteConversation(params.conversationId, userId, mutedUntil)
  }

  @Post(':conversationId/unmute')
  @ZodSerializerDto(MessageResDTO)
  async unmuteConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.unmuteConversation(params.conversationId, userId)
  }

  @Delete(':conversationId/leave')
  @ZodSerializerDto(MessageResDTO)
  async leaveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    return this.conversationService.leaveConversation(params.conversationId, userId)
  }

  // ===== MEMBER MANAGEMENT =====

  @Get(':conversationId/members')
  @ZodSerializerDto(MessageResDTO)
  async getConversationMembers(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    const members = await this.conversationService.getConversationMembers(params.conversationId, userId)
    return { data: members }
  }

  @Post(':conversationId/members')
  @ZodSerializerDto(ConversationResDTO)
  async addMembers(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Body() body: AddMembersBodyDTO,
  ) {
    return this.conversationService.addMembers(params.conversationId, userId, body.memberIds)
  }

  @Delete(':conversationId/members/:memberId')
  @ZodSerializerDto(MessageResDTO)
  async removeMember(@ActiveUser('userId') userId: number, @Param() params: MemberParamsDTO) {
    return this.conversationService.removeMember(params.conversationId, userId, params.memberId)
  }

  @Put(':conversationId/members/:memberId/role')
  @ZodSerializerDto(MessageResDTO)
  async updateMemberRole(
    @ActiveUser('userId') userId: number,
    @Param() params: MemberParamsDTO,
    @Body() body: { role: 'ADMIN' | 'MODERATOR' | 'MEMBER' },
  ) {
    return this.conversationService.updateMemberRole(params.conversationId, userId, params.memberId, body.role)
  }

  // ===== MESSAGE MANAGEMENT =====

  @Get(':conversationId/messages')
  @ZodSerializerDto(MessagesListResDTO)
  async getMessages(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationParamsDTO,
    @Query() query: GetMessagesQueryDTO,
  ) {
    return this.messageService.getConversationMessages(params.conversationId, userId, query)
  }

  @Get(':conversationId/messages/stats')
  @ZodSerializerDto(MessageResDTO)
  async getMessageStats(@ActiveUser('userId') userId: number, @Param() params: ConversationParamsDTO) {
    const stats = await this.messageService.getMessageStats(params.conversationId, userId)
    return { data: stats }
  }

  @Get('messages/search')
  @ZodSerializerDto(MessageSearchResultResDTO)
  async searchMessages(@ActiveUser('userId') userId: number, @Query() query: SearchMessagesQueryDTO) {
    return this.messageService.searchMessages(userId, query.q, {
      page: query.page,
      limit: query.limit,
      type: query.type,
      fromUserId: query.fromUserId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })
  }

  @Post('messages')
  @ZodSerializerDto(ConversationMessageResDTO)
  async sendMessage(@ActiveUser('userId') userId: number, @Body() body: SendMessageBodyDTO) {
    return this.messageService.sendMessage(userId, body)
  }

  @Get('messages/:messageId')
  @ZodSerializerDto(ConversationMessageResDTO)
  async getMessage(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    return this.messageService.getMessageById(params.messageId, userId)
  }

  @Put('messages/:messageId')
  @ZodSerializerDto(ConversationMessageResDTO)
  async editMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Body() body: { content: string },
  ) {
    return this.messageService.editMessage(params.messageId, userId, body.content)
  }

  @Delete('messages/:messageId')
  @ZodSerializerDto(ConversationMessageResDTO)
  async deleteMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Query('forEveryone') forEveryone?: string,
  ) {
    const deleteForEveryone = forEveryone === 'true'
    return this.messageService.deleteMessage(params.messageId, userId, deleteForEveryone)
  }

  // ===== MESSAGE INTERACTIONS =====

  @Post('messages/read')
  @ZodSerializerDto(MessageResDTO)
  async markAsRead(@ActiveUser('userId') userId: number, @Body() body: MarkAsReadBodyDTO) {
    const result = await this.messageService.markAsRead(body.conversationId, userId, body.messageId)
    return { message: `Đã đánh dấu ${result.markedCount} tin nhắn là đã đọc` }
  }

  @Post('messages/:messageId/react')
  @ZodSerializerDto(MessageResDTO)
  async reactToMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Body() body: { emoji: string },
  ) {
    const result = await this.messageService.reactToMessage(params.messageId, userId, body.emoji)
    return {
      message: result.action === 'added' ? 'Đã thêm reaction' : 'Đã xóa reaction',
      data: result,
    }
  }

  @Delete('messages/:messageId/react')
  @ZodSerializerDto(MessageResDTO)
  async removeReaction(
    @ActiveUser('userId') userId: number,
    @Param() params: MessageParamsDTO,
    @Query('emoji') emoji: string,
  ) {
    return this.messageService.removeReaction(params.messageId, userId, emoji)
  }

  @Get('messages/:messageId/reactions/stats')
  @ZodSerializerDto(MessageResDTO)
  async getReactionStats(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    const stats = await this.messageService.getReactionStats(params.messageId, userId)
    return { data: stats }
  }

  @Get('messages/:messageId/read-receipts/stats')
  @ZodSerializerDto(MessageResDTO)
  async getReadReceiptStats(@ActiveUser('userId') userId: number, @Param() params: MessageParamsDTO) {
    const stats = await this.messageService.getReadReceiptStats(params.messageId, userId)
    return { data: stats }
  }
}
