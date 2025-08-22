import { Module } from '@nestjs/common'

// Import chat services and handlers
import { ChatRedisService } from './services/chat-redis.service'
import { ChatConnectionHandler } from './handlers/chat-connection.handler'
import { ChatMessageHandler } from './handlers/chat-message.handler'
import { ChatTypingHandler } from './handlers/chat-typing.handler'
import { ChatInteractionHandler } from './handlers/chat-interaction.handler'

// Import conversation module for services
import { ConversationModule } from 'src/routes/conversation/conversation.module'

@Module({
  imports: [ConversationModule],
  providers: [
    // Chat services
    ChatRedisService,
    ChatConnectionHandler,
    ChatMessageHandler,
    ChatTypingHandler,
    ChatInteractionHandler,
  ],
  exports: [ChatRedisService, ChatConnectionHandler, ChatMessageHandler, ChatTypingHandler, ChatInteractionHandler],
})
export class ChatModule {}
