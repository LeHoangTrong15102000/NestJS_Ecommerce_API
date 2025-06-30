import { Injectable } from '@nestjs/common'
import { ICommand, ICommandHandler } from '../interfaces/command.interface'
import { Result } from '../types/result.type'

// Interface cho validators
export interface IValidator<T> {
  validate(input: T): Promise<ValidationResult>
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

// Validation decorator cho CommandHandler
@Injectable()
export class ValidationCommandDecorator<TCommand extends ICommand<TResponse>, TResponse>
  implements ICommandHandler<TCommand, TResponse>
{
  constructor(
    private readonly innerHandler: ICommandHandler<TCommand, TResponse>,
    private readonly validators: IValidator<TCommand>[] = [],
  ) {}

  async handle(command: TCommand): Promise<Result<TResponse>> {
    // 1. Validate command
    const validationFailures = await this.validateCommand(command)

    if (validationFailures.length > 0) {
      const errorMessage = validationFailures.map((v) => `${v.field}: ${v.message}`).join(', ')
      return Result.failure(new Error(`Validation failed: ${errorMessage}`))
    }

    // 2. Call inner handler
    return await this.innerHandler.handle(command)
  }

  private async validateCommand(command: TCommand): Promise<ValidationError[]> {
    if (this.validators.length === 0) {
      return []
    }

    const validationResults = await Promise.all(this.validators.map((validator) => validator.validate(command)))

    return validationResults.filter((result) => !result.isValid).flatMap((result) => result.errors)
  }
}
