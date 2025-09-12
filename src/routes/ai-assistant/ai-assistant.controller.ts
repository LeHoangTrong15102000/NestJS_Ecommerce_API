import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Response } from 'express'
import { ActiveUser } from 'src/shared/decorators/active-user.decorator'
import { AIAssistantService } from './ai-assistant.service'
import {
  CreateAIConversationDto,
  SendAIMessageDto,
  GetConversationsQueryDto,
  SearchMessagesQueryDto,
  TestStreamingQueryDto,
  ConversationIdParamDto,
  StreamingEventData,
} from './ai-assistant.dto'

@Controller('ai-assistant')
export class AIAssistantController {
  private readonly logger = new Logger(AIAssistantController.name)

  constructor(private readonly aiAssistantService: AIAssistantService) {}

  /**
   * Tạo conversation mới với AI Assistant
   * POST /ai-assistant/conversations
   */
  @Post('conversations')
  async createConversation(@ActiveUser('userId') userId: number, @Body() dto: CreateAIConversationDto) {
    try {
      const conversation = await this.aiAssistantService.createConversation(userId, dto)

      return {
        success: true,
        message: 'Tạo cuộc trò chuyện AI thành công',
        data: conversation,
      }
    } catch (error) {
      this.logger.error('Error creating AI conversation:', error)
      return {
        success: false,
        message: 'Không thể tạo cuộc trò chuyện AI',
        error: error.message,
      }
    }
  }

  /**
   * Lấy danh sách conversations của user
   * GET /ai-assistant/conversations
   */
  @Get('conversations')
  async getConversations(@ActiveUser('userId') userId: number, @Query() query: GetConversationsQueryDto) {
    try {
      const result = query.archived
        ? await this.aiAssistantService.getArchivedConversations(userId, query.page, query.limit)
        : await this.aiAssistantService.getUserConversations(userId, query.page, query.limit)

      return {
        success: true,
        message: 'Lấy danh sách cuộc trò chuyện thành công',
        data: result,
      }
    } catch (error) {
      this.logger.error('Error getting conversations:', error)
      return {
        success: false,
        message: 'Không thể lấy danh sách cuộc trò chuyện',
        error: error.message,
      }
    }
  }

  /**
   * Lấy chi tiết conversation
   * GET /ai-assistant/conversations/:id
   */
  @Get('conversations/:id')
  async getConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationIdParamDto) {
    try {
      const conversation = await this.aiAssistantService.getConversationDetails(params.id, userId)

      if (!conversation) {
        return {
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        }
      }

      return {
        success: true,
        message: 'Lấy chi tiết cuộc trò chuyện thành công',
        data: conversation,
      }
    } catch (error) {
      this.logger.error('Error getting conversation details:', error)
      return {
        success: false,
        message: 'Không thể lấy chi tiết cuộc trò chuyện',
        error: error.message,
      }
    }
  }

  /**
   * Gửi tin nhắn trong conversation
   * POST /ai-assistant/conversations/:id/messages
   */
  @Post('conversations/:id/messages')
  async sendMessage(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationIdParamDto,
    @Body() dto: SendAIMessageDto,
  ) {
    try {
      const result = await this.aiAssistantService.sendMessage(params.id, userId, dto)

      return {
        success: true,
        message: 'Gửi tin nhắn thành công',
        data: result,
      }
    } catch (error) {
      this.logger.error('Error sending message:', error)
      return {
        success: false,
        message: 'Không thể gửi tin nhắn',
        error: error.message,
      }
    }
  }

  /**
   * Archive conversation
   * PATCH /ai-assistant/conversations/:id/archive
   */
  @Patch('conversations/:id/archive')
  async archiveConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationIdParamDto) {
    try {
      const result = await this.aiAssistantService.archiveConversation(params.id, userId)

      return {
        success: true,
        message: 'Lưu trữ cuộc trò chuyện thành công',
        data: result,
      }
    } catch (error) {
      this.logger.error('Error archiving conversation:', error)
      return {
        success: false,
        message: 'Không thể lưu trữ cuộc trò chuyện',
        error: error.message,
      }
    }
  }

  /**
   * Delete conversation
   * DELETE /ai-assistant/conversations/:id
   */
  @Delete('conversations/:id')
  async deleteConversation(@ActiveUser('userId') userId: number, @Param() params: ConversationIdParamDto) {
    try {
      const result = await this.aiAssistantService.deleteConversation(params.id, userId)

      return {
        success: true,
        message: 'Xóa cuộc trò chuyện thành công',
        data: result,
      }
    } catch (error) {
      this.logger.error('Error deleting conversation:', error)
      return {
        success: false,
        message: 'Không thể xóa cuộc trò chuyện',
        error: error.message,
      }
    }
  }

  /**
   * Tìm kiếm tin nhắn
   * GET /ai-assistant/search
   */
  @Get('search')
  async searchMessages(@ActiveUser('userId') userId: number, @Query() query: SearchMessagesQueryDto) {
    try {
      const result = await this.aiAssistantService.searchMessages(userId, query.q, query.page, query.limit)
      return {
        success: true,
        message: 'Tìm kiếm tin nhắn thành công',
        data: result,
      }
    } catch (error) {
      this.logger.error('Error searching messages:', error)
      return {
        success: false,
        message: 'Không thể tìm kiếm tin nhắn',
        error: error.message,
      }
    }
  }

  /**
   * Lấy thống kê AI conversations của user
   * GET /ai-assistant/stats
   */
  @Get('stats')
  async getUserStats(@ActiveUser('userId') userId: number) {
    try {
      const stats = await this.aiAssistantService.getUserStats(userId)
      return {
        success: true,
        message: 'Lấy thống kê thành công',
        data: stats,
      }
    } catch (error) {
      this.logger.error('Error getting user stats:', error)
      return {
        success: false,
        message: 'Không thể lấy thống kê',
        error: error.message,
      }
    }
  }

  /**
   * Test AI Assistant (không cần authentication)
   * GET /ai-assistant/test?message=hello
   */
  @Get('test')
  async testAIAssistant(@Query() query: TestStreamingQueryDto) {
    try {
      const response = await this.aiAssistantService.generateResponse([], query.message)

      return {
        success: true,
        message: 'Test AI Assistant thành công',
        data: {
          userMessage: query.message,
          aiResponse: response,
          timestamp: new Date().toISOString(),
        },
      }
    } catch (error) {
      this.logger.error('Error testing AI Assistant:', error)
      return {
        success: false,
        message: 'Test AI Assistant thất bại',
        error: error.message,
      }
    }
  }

  /**
   * Test AI streaming (không cần authentication)
   * GET /ai-assistant/test-stream?message=hello
   */
  @Get('test-stream')
  async testAIStreaming(@Query() query: TestStreamingQueryDto, @Res() res: Response) {
    try {
      // Setup Server-Sent Events headers
      res.writeHead(HttpStatus.OK, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      // Send initial event
      const startEvent: StreamingEventData = {
        type: 'start',
        message: 'Bắt đầu streaming AI Assistant...',
        userMessage: query.message,
        timestamp: new Date().toISOString(),
      }
      res.write(`data: ${JSON.stringify(startEvent)}\n\n`)

      let fullResponse = ''

      // Handle streaming callbacks
      const callbacks = {
        onChunk: (chunk: string) => {
          fullResponse += chunk
          const chunkEvent: StreamingEventData = {
            type: 'chunk',
            content: chunk,
            fullContent: fullResponse,
          }
          res.write(`data: ${JSON.stringify(chunkEvent)}\n\n`)
        },
        onComplete: () => {
          const completeEvent: StreamingEventData = {
            type: 'complete',
            message: 'AI streaming hoàn tất',
            fullResponse,
            timestamp: new Date().toISOString(),
          }
          res.write(`data: ${JSON.stringify(completeEvent)}\n\n`)
          res.end()
        },
        onError: (error: string) => {
          const errorEvent: StreamingEventData = {
            type: 'error',
            message: error,
            fallback: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
          }
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
          res.end()
        },
      }

      // Start streaming
      await this.aiAssistantService.generateStreamingResponse([], query.message, callbacks)
    } catch (error) {
      this.logger.error('Error in AI streaming:', error)

      const errorEvent: StreamingEventData = {
        type: 'error',
        message: error.message || 'Internal server error',
        fallback: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
      }

      try {
        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
        res.end()
      } catch (resError) {
        this.logger.error('Error writing to response:', resError)
      }
    }
  }

  /**
   * Streaming cho conversation có authentication
   * GET /ai-assistant/conversations/:id/stream?message=hello
   */
  @Get('conversations/:id/stream')
  async streamInConversation(
    @ActiveUser('userId') userId: number,
    @Param() params: ConversationIdParamDto,
    @Query() query: TestStreamingQueryDto,
    @Res() res: Response,
  ) {
    try {
      // Verify conversation ownership
      const conversation = await this.aiAssistantService.getConversationDetails(params.id, userId)

      if (!conversation) {
        res.status(HttpStatus.NOT_FOUND).json({
          success: false,
          message: 'Không tìm thấy cuộc trò chuyện',
        })
        return
      }

      // Setup Server-Sent Events headers
      res.writeHead(HttpStatus.OK, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      })

      // Send initial event
      const startEvent: StreamingEventData = {
        type: 'start',
        message: 'Bắt đầu streaming...',
        userMessage: query.message,
        timestamp: new Date().toISOString(),
      }
      res.write(`data: ${JSON.stringify(startEvent)}\n\n`)

      let fullResponse = ''

      // Handle streaming callbacks
      const callbacks = {
        onChunk: (chunk: string) => {
          fullResponse += chunk
          const chunkEvent: StreamingEventData = {
            type: 'chunk',
            content: chunk,
            fullContent: fullResponse,
          }
          res.write(`data: ${JSON.stringify(chunkEvent)}\n\n`)
        },
        onComplete: () => {
          const completeEvent: StreamingEventData = {
            type: 'complete',
            message: 'Streaming hoàn tất',
            fullResponse,
            timestamp: new Date().toISOString(),
          }
          res.write(`data: ${JSON.stringify(completeEvent)}\n\n`)
          res.end()
        },
        onError: (error: string) => {
          const errorEvent: StreamingEventData = {
            type: 'error',
            message: error,
            fallback: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
          }
          res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
          res.end()
        },
      }

      // Start streaming with conversation context
      await this.aiAssistantService.generateStreamingResponse(conversation.messages || [], query.message, callbacks)
    } catch (error) {
      this.logger.error('Error in conversation streaming:', error)

      const errorEvent: StreamingEventData = {
        type: 'error',
        message: error.message || 'Internal server error',
        fallback: 'Xin lỗi, có lỗi xảy ra. Vui lòng thử lại sau.',
      }

      try {
        res.write(`data: ${JSON.stringify(errorEvent)}\n\n`)
        res.end()
      } catch (resError) {
        this.logger.error('Error writing to response:', resError)
      }
    }
  }
}

