import { Module } from '@nestjs/common'
import { PaymentGateway } from 'src/websockets/payment.gateway'
import { EnhancedChatGateway } from 'src/websockets/enhanced-chat.gateway'

// Import chat module
import { ChatModule } from './chat.module'

@Module({
  imports: [ChatModule],
  providers: [PaymentGateway, EnhancedChatGateway],
})
export class WebsocketModule {}
