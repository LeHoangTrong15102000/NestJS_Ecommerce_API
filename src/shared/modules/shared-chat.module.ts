import { Global, Module } from '@nestjs/common'
import { SharedChatService } from '../services/chat.service'
import { ConversationModule } from 'src/routes/conversation/conversation.module'

@Global()
@Module({
  imports: [ConversationModule],
  providers: [SharedChatService],
  exports: [SharedChatService],
})
export class SharedChatModule {}
