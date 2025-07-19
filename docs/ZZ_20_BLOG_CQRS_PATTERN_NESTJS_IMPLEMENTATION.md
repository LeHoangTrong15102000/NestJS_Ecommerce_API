# CQRS Pattern - Cách Triển Khai Đúng Đắn Từ Đầu (NestJS Implementation)

## Tổng Quan

Bài viết này dựa trên blog của Milan Jovanović về việc triển khai CQRS pattern một cách đơn giản và hiệu quả, được chuyển đổi để áp dụng trong NestJS thay vì .NET.

### Vấn Đề Hiện Tại

- **MediatR** đang chuyển sang mô hình thương mại
- Nhiều teams cần tìm giải pháp thay thế
- **CQRS ≠ MediatR** - MediatR chỉ là một lớp dispatching mỏng
- Hầu hết projects chỉ sử dụng nó như một thin dispatching layer

### Lợi Ích Khi Bỏ MediatR (Áp Dụng Cho NestJS)

✅ **Kiểm soát hoàn toàn** CQRS infrastructure  
✅ **Handler dispatching rõ ràng**, có thể dự đoán được  
✅ **Debugging và onboarding đơn giản** hơn  
✅ **DI setup sạch hơn** và testability tốt hơn  
✅ **Không có magic**, không có runtime indirection

---

## 1. Commands, Queries và Handlers

### 1.1 Định Nghĩa Interfaces Cơ Bản

**Commands (TypeScript/NestJS):**

```typescript
// interfaces/command.interface.ts
export interface ICommand {}

export interface ICommandWithResponse<TResponse> extends ICommand {
  readonly _response?: TResponse
}
```

**Queries (TypeScript/NestJS):**

```typescript
// interfaces/query.interface.ts
export interface IQuery<TResponse> {
  readonly _response?: TResponse
}
```

**Command Handlers:**

```typescript
// interfaces/command-handler.interface.ts
import { Result } from '../types/result.type'

export interface ICommandHandler<TCommand extends ICommand> {
  handle(command: TCommand): Promise<Result<void>>
}

export interface ICommandHandlerWithResponse<TCommand extends ICommandWithResponse<TResponse>, TResponse> {
  handle(command: TCommand): Promise<Result<TResponse>>
}
```

**Query Handlers:**

```typescript
// interfaces/query-handler.interface.ts
import { Result } from '../types/result.type'

export interface IQueryHandler<TQuery extends IQuery<TResponse>, TResponse> {
  handle(query: TQuery): Promise<Result<TResponse>>
}
```

### 1.2 Result Type Implementation

```typescript
// types/result.type.ts
export class Result<T = void> {
  private constructor(
    private readonly _isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: Error,
  ) {}

  static success<T>(value?: T): Result<T> {
    return new Result<T>(true, value)
  }

  static failure<T>(error: Error): Result<T> {
    return new Result<T>(false, undefined, error)
  }

  get isSuccess(): boolean {
    return this._isSuccess
  }

  get isFailure(): boolean {
    return !this._isSuccess
  }

  get value(): T | undefined {
    return this._value
  }

  get error(): Error | undefined {
    return this._error
  }

  match<TResult>(onSuccess: (value: T) => TResult, onFailure: (error: Error) => TResult): TResult {
    if (this._isSuccess) {
      return onSuccess(this._value!)
    }
    return onFailure(this._error!)
  }
}
```

---

## 2. Ví Dụ Thực Tế: Command Handler

### 2.1 Complete Todo Command

```typescript
// commands/complete-todo.command.ts
import { ICommand } from '../interfaces/command.interface'

export class CompleteTodoCommand implements ICommand {
  constructor(public readonly todoItemId: string) {}
}
```

### 2.2 Complete Todo Command Handler

```typescript
// handlers/complete-todo.handler.ts
import { Injectable } from '@nestjs/common'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { CompleteTodoCommand } from '../commands/complete-todo.command'
import { Result } from '../types/result.type'
import { PrismaService } from '../../shared/services/prisma.service'
import { UserContext } from '../../shared/contexts/user.context'

@Injectable()
export class CompleteTodoCommandHandler implements ICommandHandler<CompleteTodoCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userContext: UserContext,
  ) {}

  async handle(command: CompleteTodoCommand): Promise<Result<void>> {
    const todoItem = await this.prisma.todoItem.findFirst({
      where: {
        id: command.todoItemId,
        userId: this.userContext.userId,
      },
    })

    if (!todoItem) {
      return Result.failure(new Error(`Todo item with ID ${command.todoItemId} not found`))
    }

    if (todoItem.isCompleted) {
      return Result.failure(new Error(`Todo item ${command.todoItemId} is already completed`))
    }

    await this.prisma.todoItem.update({
      where: { id: command.todoItemId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    })

    // Raise domain event (nếu cần)
    // this.eventBus.publish(new TodoItemCompletedEvent(todoItem.id));

    return Result.success()
  }
}
```

---

## 3. Decorators (Cross-Cutting Concerns)

### 3.1 Logging Decorator

```typescript
// decorators/logging-command.decorator.ts
import { Injectable, Logger } from '@nestjs/common'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { ICommand } from '../interfaces/command.interface'
import { Result } from '../types/result.type'

@Injectable()
export class LoggingCommandDecorator<TCommand extends ICommand> implements ICommandHandler<TCommand> {
  private readonly logger = new Logger(LoggingCommandDecorator.name)

  constructor(private readonly innerHandler: ICommandHandler<TCommand>) {}

  async handle(command: TCommand): Promise<Result<void>> {
    const commandName = command.constructor.name

    this.logger.log(`Processing command: ${commandName}`)

    try {
      const result = await this.innerHandler.handle(command)

      if (result.isSuccess) {
        this.logger.log(`Completed command: ${commandName}`)
      } else {
        this.logger.error(`Completed command ${commandName} with error: ${result.error?.message}`, result.error?.stack)
      }

      return result
    } catch (error) {
      this.logger.error(`Command ${commandName} threw exception: ${error.message}`, error.stack)
      throw error
    }
  }
}
```

### 3.2 Validation Decorator

```typescript
// decorators/validation-command.decorator.ts
import { Injectable } from '@nestjs/common'
import { validate } from 'class-validator'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { ICommand } from '../interfaces/command.interface'
import { Result } from '../types/result.type'

@Injectable()
export class ValidationCommandDecorator<TCommand extends ICommand> implements ICommandHandler<TCommand> {
  constructor(private readonly innerHandler: ICommandHandler<TCommand>) {}

  async handle(command: TCommand): Promise<Result<void>> {
    // Validate command using class-validator
    const validationErrors = await validate(command as any)

    if (validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error) => Object.values(error.constraints || {}).join(', '))
        .join('; ')

      return Result.failure(new Error(`Validation failed: ${errorMessages}`))
    }

    return await this.innerHandler.handle(command)
  }
}
```

### 3.3 Transaction Decorator

```typescript
// decorators/transaction-command.decorator.ts
import { Injectable } from '@nestjs/common'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { ICommand } from '../interfaces/command.interface'
import { Result } from '../types/result.type'
import { PrismaService } from '../../shared/services/prisma.service'

@Injectable()
export class TransactionCommandDecorator<TCommand extends ICommand> implements ICommandHandler<TCommand> {
  constructor(
    private readonly innerHandler: ICommandHandler<TCommand>,
    private readonly prisma: PrismaService,
  ) {}

  async handle(command: TCommand): Promise<Result<void>> {
    return await this.prisma.$transaction(async (tx) => {
      // Inject transaction context vào inner handler nếu cần
      return await this.innerHandler.handle(command)
    })
  }
}
```

---

## 4. Dependency Injection Setup

### 4.1 CQRS Module

```typescript
// cqrs/cqrs.module.ts
import { Module, DynamicModule } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'
import { CqrsExplorer } from './cqrs.explorer'
import { CommandBus } from './command-bus'
import { QueryBus } from './query-bus'

@Module({
  imports: [DiscoveryModule],
  providers: [CqrsExplorer, CommandBus, QueryBus],
  exports: [CommandBus, QueryBus],
})
export class CqrsModule {
  static forRoot(): DynamicModule {
    return {
      module: CqrsModule,
      global: true,
    }
  }
}
```

### 4.2 Command Bus Implementation

```typescript
// cqrs/command-bus.ts
import { Injectable, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { ICommand } from './interfaces/command.interface'
import { ICommandHandler } from './interfaces/command-handler.interface'
import { Result } from './types/result.type'

@Injectable()
export class CommandBus {
  private readonly handlers = new Map<string, Type<ICommandHandler<any>>>()

  constructor(private readonly moduleRef: ModuleRef) {}

  register<TCommand extends ICommand>(command: Type<TCommand>, handler: Type<ICommandHandler<TCommand>>) {
    this.handlers.set(command.name, handler)
  }

  async execute<TCommand extends ICommand>(command: TCommand): Promise<Result<void>> {
    const commandName = command.constructor.name
    const handlerType = this.handlers.get(commandName)

    if (!handlerType) {
      throw new Error(`No handler registered for command: ${commandName}`)
    }

    const handler = this.moduleRef.get(handlerType, { strict: false })
    return await handler.handle(command)
  }
}
```

### 4.3 Query Bus Implementation

```typescript
// cqrs/query-bus.ts
import { Injectable, Type } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { IQuery } from './interfaces/query.interface'
import { IQueryHandler } from './interfaces/query-handler.interface'
import { Result } from './types/result.type'

@Injectable()
export class QueryBus {
  private readonly handlers = new Map<string, Type<IQueryHandler<any, any>>>()

  constructor(private readonly moduleRef: ModuleRef) {}

  register<TQuery extends IQuery<TResponse>, TResponse>(
    query: Type<TQuery>,
    handler: Type<IQueryHandler<TQuery, TResponse>>,
  ) {
    this.handlers.set(query.name, handler)
  }

  async execute<TQuery extends IQuery<TResponse>, TResponse>(query: TQuery): Promise<Result<TResponse>> {
    const queryName = query.constructor.name
    const handlerType = this.handlers.get(queryName)

    if (!handlerType) {
      throw new Error(`No handler registered for query: ${queryName}`)
    }

    const handler = this.moduleRef.get(handlerType, { strict: false })
    return await handler.handle(query)
  }
}
```

### 4.4 Auto-Discovery với Decorators

```typescript
// decorators/command-handler.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const COMMAND_HANDLER_METADATA = 'COMMAND_HANDLER_METADATA'

export const CommandHandler = (command: any): ClassDecorator => {
  return SetMetadata(COMMAND_HANDLER_METADATA, command)
}
```

```typescript
// decorators/query-handler.decorator.ts
import { SetMetadata } from '@nestjs/common'

export const QUERY_HANDLER_METADATA = 'QUERY_HANDLER_METADATA'

export const QueryHandler = (query: any): ClassDecorator => {
  return SetMetadata(QUERY_HANDLER_METADATA, query)
}
```

### 4.5 CQRS Explorer (Auto-Registration)

```typescript
// cqrs/cqrs.explorer.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { InstanceWrapper } from '@nestjs/core/injector/instance-wrapper'
import { CommandBus } from './command-bus'
import { QueryBus } from './query-bus'
import { COMMAND_HANDLER_METADATA } from './decorators/command-handler.decorator'
import { QUERY_HANDLER_METADATA } from './decorators/query-handler.decorator'

@Injectable()
export class CqrsExplorer implements OnModuleInit {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  onModuleInit() {
    this.explore()
  }

  explore() {
    const providers: InstanceWrapper[] = [
      ...this.discoveryService.getProviders(),
      ...this.discoveryService.getControllers(),
    ]

    providers
      .filter((wrapper) => wrapper.isDependencyTreeStatic())
      .filter((wrapper) => wrapper.instance)
      .forEach((wrapper: InstanceWrapper) => {
        const { instance } = wrapper
        const prototype = Object.getPrototypeOf(instance)

        this.registerCommandHandler(instance, prototype)
        this.registerQueryHandler(instance, prototype)
      })
  }

  private registerCommandHandler(instance: any, prototype: any) {
    const commandMetadata = this.reflector.get(COMMAND_HANDLER_METADATA, instance.constructor)

    if (commandMetadata) {
      this.commandBus.register(commandMetadata, instance.constructor)
    }
  }

  private registerQueryHandler(instance: any, prototype: any) {
    const queryMetadata = this.reflector.get(QUERY_HANDLER_METADATA, instance.constructor)

    if (queryMetadata) {
      this.queryBus.register(queryMetadata, instance.constructor)
    }
  }
}
```

---

## 5. Sử Dụng Trong Controller

### 5.1 Todo Controller Example

```typescript
// controllers/todo.controller.ts
import { Controller, Put, Param, HttpCode, HttpStatus } from '@nestjs/common'
import { CommandBus } from '../cqrs/command-bus'
import { CompleteTodoCommand } from '../commands/complete-todo.command'
import { Result } from '../cqrs/types/result.type'

@Controller('todos')
export class TodoController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':id/complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async completeTodo(@Param('id') id: string): Promise<void> {
    const command = new CompleteTodoCommand(id)

    const result = await this.commandBus.execute(command)

    return result.match(
      () => undefined, // Success case - return void
      (error) => {
        throw error // Let global exception filter handle it
      },
    )
  }
}
```

### 5.2 Advanced Controller với Query

```typescript
// controllers/todo-query.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common'
import { QueryBus } from '../cqrs/query-bus'
import { GetTodoQuery } from '../queries/get-todo.query'
import { GetTodosQuery } from '../queries/get-todos.query'

@Controller('todos')
export class TodoQueryController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':id')
  async getTodo(@Param('id') id: string) {
    const query = new GetTodoQuery(id)

    const result = await this.queryBus.execute(query)

    return result.match(
      (todo) => todo,
      (error) => {
        throw error
      },
    )
  }

  @Get()
  async getTodos(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    const query = new GetTodosQuery(page, limit)

    const result = await this.queryBus.execute(query)

    return result.match(
      (todos) => todos,
      (error) => {
        throw error
      },
    )
  }
}
```

---

## 6. Handler Registration với Decorator

### 6.1 Command Handler với Decorator

```typescript
// handlers/complete-todo.handler.ts
import { Injectable } from '@nestjs/common'
import { CommandHandler } from '../decorators/command-handler.decorator'
import { CompleteTodoCommand } from '../commands/complete-todo.command'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { Result } from '../types/result.type'

@Injectable()
@CommandHandler(CompleteTodoCommand)
export class CompleteTodoCommandHandler implements ICommandHandler<CompleteTodoCommand> {
  // Implementation như đã viết ở trên...
  async handle(command: CompleteTodoCommand): Promise<Result<void>> {
    // ... logic implementation
    return Result.success()
  }
}
```

### 6.2 Query Handler với Decorator

```typescript
// handlers/get-todo.handler.ts
import { Injectable } from '@nestjs/common'
import { QueryHandler } from '../decorators/query-handler.decorator'
import { GetTodoQuery } from '../queries/get-todo.query'
import { IQueryHandler } from '../interfaces/query-handler.interface'
import { Result } from '../types/result.type'

export interface TodoDto {
  id: string
  title: string
  isCompleted: boolean
  completedAt?: Date
}

@Injectable()
@QueryHandler(GetTodoQuery)
export class GetTodoQueryHandler implements IQueryHandler<GetTodoQuery, TodoDto> {
  constructor(private readonly prisma: PrismaService) {}

  async handle(query: GetTodoQuery): Promise<Result<TodoDto>> {
    const todo = await this.prisma.todoItem.findUnique({
      where: { id: query.todoId },
    })

    if (!todo) {
      return Result.failure(new Error(`Todo with ID ${query.todoId} not found`))
    }

    const todoDto: TodoDto = {
      id: todo.id,
      title: todo.title,
      isCompleted: todo.isCompleted,
      completedAt: todo.completedAt,
    }

    return Result.success(todoDto)
  }
}
```

---

## 7. Module Setup Hoàn Chỉnh

### 7.1 Todo Module

```typescript
// todo/todo.module.ts
import { Module } from '@nestjs/common'
import { CqrsModule } from '../cqrs/cqrs.module'
import { TodoController } from './controllers/todo.controller'
import { TodoQueryController } from './controllers/todo-query.controller'
import { CompleteTodoCommandHandler } from './handlers/complete-todo.handler'
import { GetTodoQueryHandler } from './handlers/get-todo.handler'
import { SharedModule } from '../shared/shared.module'

@Module({
  imports: [CqrsModule.forRoot(), SharedModule],
  controllers: [TodoController, TodoQueryController],
  providers: [CompleteTodoCommandHandler, GetTodoQueryHandler],
})
export class TodoModule {}
```

### 7.2 App Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { CqrsModule } from './cqrs/cqrs.module'
import { TodoModule } from './todo/todo.module'
import { SharedModule } from './shared/shared.module'

@Module({
  imports: [CqrsModule.forRoot(), SharedModule, TodoModule],
})
export class AppModule {}
```

---

## 8. Kết Luận

### 8.1 Lợi Ích Của Approach Này

✅ **Đơn giản**: Chỉ cần vài interface và một số decorator classes  
✅ **Rõ ràng**: Không có magic, không có runtime indirection  
✅ **Dễ test**: Handler được inject trực tiếp, không cần mock mediator  
✅ **Linh hoạt**: Dễ dàng thêm decorators cho cross-cutting concerns  
✅ **Hiệu suất**: Không có overhead của mediator pattern  
✅ **Type-safe**: Tận dụng được TypeScript type system

### 8.2 So Sánh Với MediatR/.NET

| Aspect             | .NET + MediatR  | NestJS Implementation        |
| ------------------ | --------------- | ---------------------------- |
| **Dependencies**   | MediatR package | Custom interfaces            |
| **Registration**   | Scrutor         | Custom explorer + decorators |
| **Type Safety**    | Compile-time    | TypeScript compile-time      |
| **Decorators**     | Manual wrapping | NestJS decorator pattern     |
| **DI Integration** | .NET DI         | NestJS DI container          |
| **Testing**        | Mock ISender    | Mock handlers directly       |

### 8.3 Khi Nào Nên Sử Dụng

✅ **Phù hợp khi:**

- Cần kiểm soát hoàn toàn CQRS infrastructure
- Muốn tránh dependencies ngoài
- Team cần hiểu rõ cách thức hoạt động
- Application có requirements đặc biệt về logging/validation

❌ **Không phù hợp khi:**

- Team chưa quen với CQRS pattern
- Cần rapid prototyping
- Application đơn giản, không cần separation of concerns phức tạp

---

## 9. Bonus: Advanced Features

### 9.1 Pipeline Behaviors

```typescript
// behaviors/timing.behavior.ts
import { Injectable, Logger } from '@nestjs/common'
import { ICommandHandler } from '../interfaces/command-handler.interface'
import { ICommand } from '../interfaces/command.interface'
import { Result } from '../types/result.type'

@Injectable()
export class TimingBehavior<TCommand extends ICommand> implements ICommandHandler<TCommand> {
  private readonly logger = new Logger(TimingBehavior.name)

  constructor(private readonly innerHandler: ICommandHandler<TCommand>) {}

  async handle(command: TCommand): Promise<Result<void>> {
    const start = Date.now()
    const commandName = command.constructor.name

    try {
      const result = await this.innerHandler.handle(command)
      const duration = Date.now() - start

      this.logger.log(`${commandName} executed in ${duration}ms`)

      return result
    } catch (error) {
      const duration = Date.now() - start
      this.logger.error(`${commandName} failed after ${duration}ms`)
      throw error
    }
  }
}
```

### 9.2 Caching Decorator cho Queries

```typescript
// decorators/caching-query.decorator.ts
import { Injectable } from '@nestjs/common'
import { IQueryHandler } from '../interfaces/query-handler.interface'
import { IQuery } from '../interfaces/query.interface'
import { Result } from '../types/result.type'

@Injectable()
export class CachingQueryDecorator<TQuery extends IQuery<TResponse>, TResponse>
  implements IQueryHandler<TQuery, TResponse>
{
  private readonly cache = new Map<string, Result<TResponse>>()

  constructor(
    private readonly innerHandler: IQueryHandler<TQuery, TResponse>,
    private readonly cacheTtlMs: number = 300000, // 5 minutes
  ) {}

  async handle(query: TQuery): Promise<Result<TResponse>> {
    const cacheKey = this.generateCacheKey(query)

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!
    }

    const result = await this.innerHandler.handle(query)

    if (result.isSuccess) {
      this.cache.set(cacheKey, result)

      // Auto cleanup after TTL
      setTimeout(() => {
        this.cache.delete(cacheKey)
      }, this.cacheTtlMs)
    }

    return result
  }

  private generateCacheKey(query: TQuery): string {
    return `${query.constructor.name}_${JSON.stringify(query)}`
  }
}
```

Đây là một implementation hoàn chỉnh của CQRS pattern trong NestJS mà không cần phụ thuộc vào thư viện ngoài, cho phép kiểm soát hoàn toàn luồng xử lý và dễ dàng mở rộng theo nhu cầu cụ thể của dự án.
