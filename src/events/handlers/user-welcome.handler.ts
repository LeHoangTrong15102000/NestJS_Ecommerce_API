import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino'
import { UserRegisteredEvent } from 'src/events/definitions'
import { EmailService } from 'src/shared/services/email.service'

@Injectable()
export class UserWelcomeHandler {
  constructor(
    @InjectPinoLogger(UserWelcomeHandler.name) private readonly logger: PinoLogger,
    private readonly emailService: EmailService,
  ) {}

  @OnEvent('user.registered', { async: true })
  async handle(event: UserRegisteredEvent): Promise<void> {
    try {
      const { error } = await this.emailService.sendOTP({
        email: event.email,
        code: 'WELCOME',
      })
      if (error) {
        this.logger.warn(
          { eventId: event.eventId, userId: event.userId, error },
          'Welcome email returned an error from provider',
        )
        return
      }
      this.logger.info({ eventId: event.eventId, userId: event.userId }, 'Welcome email sent')
    } catch (error) {
      // Handlers never throw — log and continue
      this.logger.error({ error, eventId: event.eventId }, 'Failed to send welcome email')
    }
  }
}
