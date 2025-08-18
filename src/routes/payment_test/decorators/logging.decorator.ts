import { Injectable, Logger } from '@nestjs/common'
import { ICommand, ICommandHandler } from '../interfaces/command.interface'
import { IQuery, IQueryHandler } from '../interfaces/query.interface'
import { Result } from '../types/result.type'

// Logging decorator cho CommandHandler
@Injectable()
export class LoggingCommandDecorator<TCommand extends ICommand<TResponse>, TResponse>
  implements ICommandHandler<TCommand, TResponse>
{
  private readonly logger = new Logger(LoggingCommandDecorator.name)

  constructor(private readonly innerHandler: ICommandHandler<TCommand, TResponse>) {}

  async handle(command: TCommand): Promise<Result<TResponse>> {
    const commandName = command.constructor.name
    const startTime = Date.now()

    this.logger.log(`[COMMAND] Starting execution: ${commandName}`)
    this.logger.debug(`[COMMAND] Input: ${JSON.stringify(command)}`)

    try {
      const result = await this.innerHandler.handle(command)
      const duration = Date.now() - startTime

      if (Result.isSuccess(result)) {
        this.logger.log(`[COMMAND] Successfully completed: ${commandName} (${duration}ms)`)
      } else {
        this.logger.error(`[COMMAND] Failed: ${commandName} (${duration}ms) - Error: ${result.error?.message}`)
      }

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`[COMMAND] Exception in ${commandName} (${duration}ms)`, error)
      throw error
    }
  }
}

// Logging decorator cho QueryHandler
@Injectable()
export class LoggingQueryDecorator<TQuery extends IQuery<TResponse>, TResponse>
  implements IQueryHandler<TQuery, TResponse>
{
  private readonly logger = new Logger(LoggingQueryDecorator.name)

  constructor(private readonly innerHandler: IQueryHandler<TQuery, TResponse>) {}

  async handle(query: TQuery): Promise<TResponse> {
    const queryName = query.constructor.name
    const startTime = Date.now()

    this.logger.log(`[QUERY] Starting execution: ${queryName}`)
    this.logger.debug(`[QUERY] Input: ${JSON.stringify(query)}`)

    try {
      const result = await this.innerHandler.handle(query)
      const duration = Date.now() - startTime

      this.logger.log(`[QUERY] Successfully completed: ${queryName} (${duration}ms)`)

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      this.logger.error(`[QUERY] Exception in ${queryName} (${duration}ms)`, error)
      throw error
    }
  }
}
