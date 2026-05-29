import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets'
import { Server } from 'socket.io'
import { generateRoomUserId } from 'src/shared/helpers'

@WebSocketGateway({ namespace: 'payment' })
export class PaymentGateway {
  @WebSocketServer()
  server: Server

  @SubscribeMessage('send-money')
  handleEvent(@MessageBody() data: string): string {
    // Guard: server may be undefined when HTTP adapter is not attached (e.g. some E2E configs)
    if (!this.server) return data
    this.server.emit('receive-money', {
      data: `Money: ${data}`,
    })
    return data
  }

  emitPaymentSuccess(userId: number): void {
    // Guard: server may be undefined when HTTP adapter is not attached (e.g. some E2E configs)
    if (!this.server) return
    this.server.to(generateRoomUserId(userId)).emit('payment', {
      status: 'success',
    })
  }
}
