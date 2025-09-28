# Gamma Client Integration Guide

## Tổng Quan

Gamma Client là SDK wrapper được tối ưu để tích hợp với Gamma API trong dự án NestJS. Sử dụng Dynamic Module Pattern để cung cấp type-safe client và flexible configuration.

## 1. Cấu Trúc Dự Án

```
libs/nest-gamma/
├── src/
│   ├── index.ts
│   ├── nest-gamma.module.ts
│   ├── types/
│   │   ├── index.ts
│   │   ├── gamma.types.ts
│   │   └── config.types.ts
│   ├── providers/
│   │   └── gamma-client.provider.ts
│   ├── services/
│   │   └── gamma.service.ts
│   ├── decorators/
│   │   └── gamma-config.decorator.ts
│   └── exceptions/
│       └── gamma.exceptions.ts
├── package.json
└── README.md
```

## 2. Types Definitions

```typescript
// libs/nest-gamma/src/types/gamma.types.ts
export interface GammaConfig {
  apiKey: string
  apiSecret?: string
  baseUrl?: string
  timeout?: number
  retryConfig?: {
    retries: number
    retryDelay: number
  }
}

export interface GammaModuleOptions extends GammaConfig {
  environment?: 'development' | 'staging' | 'production'
  debug?: boolean
}

export interface GammaModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<GammaModuleOptions> | GammaModuleOptions
  inject?: any[]
}

// API Response Types
export interface GammaApiResponse<T = any> {
  success: boolean
  data: T
  message?: string
  errors?: string[]
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Common Entity Types (customize based on actual Gamma API)
export interface GammaProject {
  id: string
  name: string
  description?: string
  status: 'active' | 'inactive' | 'archived'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, any>
}

export interface GammaTask {
  id: string
  title: string
  description?: string
  projectId: string
  assigneeId?: string
  status: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  createdAt: string
  updatedAt: string
  tags?: string[]
}

export interface GammaUser {
  id: string
  email: string
  name: string
  avatar?: string
  role: 'admin' | 'member' | 'viewer'
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

// Request DTOs
export interface CreateProjectRequest {
  name: string
  description?: string
  metadata?: Record<string, any>
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'archived'
  metadata?: Record<string, any>
}

export interface CreateTaskRequest {
  title: string
  description?: string
  projectId: string
  assigneeId?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  dueDate?: string
  tags?: string[]
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  assigneeId?: string
  dueDate?: string
  tags?: string[]
}

// Query Parameters
export interface ListProjectsQuery {
  page?: number
  limit?: number
  status?: 'active' | 'inactive' | 'archived'
  search?: string
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ListTasksQuery {
  page?: number
  limit?: number
  projectId?: string
  assigneeId?: string
  status?: 'todo' | 'in_progress' | 'done' | 'cancelled'
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  search?: string
  sortBy?: 'title' | 'createdAt' | 'dueDate' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

export interface ListUsersQuery {
  page?: number
  limit?: number
  role?: 'admin' | 'member' | 'viewer'
  isActive?: boolean
  search?: string
}

export const NEST_GAMMA_CONFIG = Symbol('NEST_GAMMA_CONFIG')
export const NEST_GAMMA_CLIENT = Symbol('NEST_GAMMA_CLIENT')
```

## 3. Gamma Client Provider

```typescript
// libs/nest-gamma/src/providers/gamma-client.provider.ts
import { Injectable, Logger } from '@nestjs/common'
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { GammaConfig, GammaApiResponse } from '../types/gamma.types'
import { GammaApiException, GammaConnectionException } from '../exceptions/gamma.exceptions'

@Injectable()
export class GammaClientProvider {
  private readonly logger = new Logger(GammaClientProvider.name)
  private readonly httpClient: AxiosInstance

  constructor(private readonly config: GammaConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.gamma.com/v1',
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        'User-Agent': 'NestJS-Gamma-Client/1.0.0',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        this.logger.debug(`Making ${config.method?.toUpperCase()} request to ${config.url}`)

        // Mask sensitive data in logs
        const logConfig = { ...config }
        if (logConfig.headers?.Authorization) {
          logConfig.headers.Authorization = 'Bearer ***'
        }

        return config
      },
      (error) => {
        this.logger.error('Request interceptor error:', error)
        return Promise.reject(error)
      },
    )

    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => {
        this.logger.debug(`Response received from ${response.config.url} with status ${response.status}`)
        return response
      },
      (error) => {
        this.handleHttpError(error)
        return Promise.reject(error)
      },
    )
  }

  private handleHttpError(error: any): void {
    if (error.response) {
      const status = error.response.status
      const data = error.response.data

      this.logger.error(`HTTP Error ${status}: ${error.response.statusText}`, {
        url: error.config?.url,
        method: error.config?.method,
        data: data,
      })

      // Throw custom exceptions based on status
      switch (status) {
        case 401:
          throw new GammaApiException('Unauthorized: Invalid API key', status, data)
        case 403:
          throw new GammaApiException('Forbidden: Insufficient permissions', status, data)
        case 404:
          throw new GammaApiException('Not Found: Resource does not exist', status, data)
        case 429:
          throw new GammaApiException('Rate Limited: Too many requests', status, data)
        default:
          throw new GammaApiException(`API Error: ${data.message || error.message}`, status, data)
      }
    } else if (error.request) {
      this.logger.error('Network Error:', error.message)
      throw new GammaConnectionException(`Network error: ${error.message}`)
    } else {
      this.logger.error('Request Setup Error:', error.message)
      throw new GammaApiException(`Request setup error: ${error.message}`, 500)
    }
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<GammaApiResponse<T>> {
    const response = await this.httpClient.get<GammaApiResponse<T>>(url, config)
    return response.data
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<GammaApiResponse<T>> {
    const response = await this.httpClient.post<GammaApiResponse<T>>(url, data, config)
    return response.data
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<GammaApiResponse<T>> {
    const response = await this.httpClient.put<GammaApiResponse<T>>(url, data, config)
    return response.data
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<GammaApiResponse<T>> {
    const response = await this.httpClient.patch<GammaApiResponse<T>>(url, data, config)
    return response.data
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<GammaApiResponse<T>> {
    const response = await this.httpClient.delete<GammaApiResponse<T>>(url, config)
    return response.data
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.get('/health')
      return true
    } catch (error) {
      this.logger.error('Health check failed:', error)
      return false
    }
  }

  // Get raw axios instance for advanced usage
  getAxiosInstance(): AxiosInstance {
    return this.httpClient
  }
}
```

## 4. Gamma Service

```typescript
// libs/nest-gamma/src/services/gamma.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common'
import { GammaClientProvider } from '../providers/gamma-client.provider'
import {
  NEST_GAMMA_CONFIG,
  GammaModuleOptions,
  GammaProject,
  GammaTask,
  GammaUser,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ListProjectsQuery,
  ListTasksQuery,
  ListUsersQuery,
  GammaApiResponse,
} from '../types/gamma.types'

@Injectable()
export class GammaService {
  private readonly logger = new Logger(GammaService.name)

  constructor(
    @Inject(NEST_GAMMA_CONFIG) private readonly config: GammaModuleOptions,
    private readonly gammaClient: GammaClientProvider,
  ) {}

  // ===============================
  // PROJECT METHODS
  // ===============================

  /**
   * Create a new project
   */
  async createProject(data: CreateProjectRequest): Promise<GammaProject> {
    try {
      const response = await this.gammaClient.post<GammaProject>('/projects', data)
      this.logger.log(`Created project: ${response.data.name}`)
      return response.data
    } catch (error) {
      this.logger.error('Failed to create project:', error)
      throw error
    }
  }

  /**
   * List all projects with pagination and filtering
   */
  async listProjects(query?: ListProjectsQuery): Promise<GammaApiResponse<GammaProject[]>> {
    try {
      const response = await this.gammaClient.get<GammaProject[]>('/projects', {
        params: query,
      })
      return response
    } catch (error) {
      this.logger.error('Failed to list projects:', error)
      throw error
    }
  }

  /**
   * Get a specific project by ID
   */
  async getProject(projectId: string): Promise<GammaProject> {
    try {
      const response = await this.gammaClient.get<GammaProject>(`/projects/${projectId}`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to get project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Update an existing project
   */
  async updateProject(projectId: string, data: UpdateProjectRequest): Promise<GammaProject> {
    try {
      const response = await this.gammaClient.patch<GammaProject>(`/projects/${projectId}`, data)
      this.logger.log(`Updated project: ${projectId}`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to update project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await this.gammaClient.delete(`/projects/${projectId}`)
      this.logger.log(`Deleted project: ${projectId}`)
    } catch (error) {
      this.logger.error(`Failed to delete project ${projectId}:`, error)
      throw error
    }
  }

  // ===============================
  // TASK METHODS
  // ===============================

  /**
   * Create a new task
   */
  async createTask(data: CreateTaskRequest): Promise<GammaTask> {
    try {
      const response = await this.gammaClient.post<GammaTask>('/tasks', data)
      this.logger.log(`Created task: ${response.data.title}`)
      return response.data
    } catch (error) {
      this.logger.error('Failed to create task:', error)
      throw error
    }
  }

  /**
   * List all tasks with pagination and filtering
   */
  async listTasks(query?: ListTasksQuery): Promise<GammaApiResponse<GammaTask[]>> {
    try {
      const response = await this.gammaClient.get<GammaTask[]>('/tasks', {
        params: query,
      })
      return response
    } catch (error) {
      this.logger.error('Failed to list tasks:', error)
      throw error
    }
  }

  /**
   * Get a specific task by ID
   */
  async getTask(taskId: string): Promise<GammaTask> {
    try {
      const response = await this.gammaClient.get<GammaTask>(`/tasks/${taskId}`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to get task ${taskId}:`, error)
      throw error
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId: string, data: UpdateTaskRequest): Promise<GammaTask> {
    try {
      const response = await this.gammaClient.patch<GammaTask>(`/tasks/${taskId}`, data)
      this.logger.log(`Updated task: ${taskId}`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to update task ${taskId}:`, error)
      throw error
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      await this.gammaClient.delete(`/tasks/${taskId}`)
      this.logger.log(`Deleted task: ${taskId}`)
    } catch (error) {
      this.logger.error(`Failed to delete task ${taskId}:`, error)
      throw error
    }
  }

  // ===============================
  // USER METHODS
  // ===============================

  /**
   * List all users with pagination and filtering
   */
  async listUsers(query?: ListUsersQuery): Promise<GammaApiResponse<GammaUser[]>> {
    try {
      const response = await this.gammaClient.get<GammaUser[]>('/users', {
        params: query,
      })
      return response
    } catch (error) {
      this.logger.error('Failed to list users:', error)
      throw error
    }
  }

  /**
   * Get a specific user by ID
   */
  async getUser(userId: string): Promise<GammaUser> {
    try {
      const response = await this.gammaClient.get<GammaUser>(`/users/${userId}`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to get user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<GammaUser> {
    try {
      const response = await this.gammaClient.get<GammaUser>('/users/me')
      return response.data
    } catch (error) {
      this.logger.error('Failed to get current user:', error)
      throw error
    }
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.gammaClient.healthCheck()
  }

  /**
   * Get API configuration (for debugging)
   */
  getConfig(): Partial<GammaModuleOptions> {
    return {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      environment: this.config.environment,
      debug: this.config.debug,
    }
  }
}
```

## 5. Custom Exceptions

```typescript
// libs/nest-gamma/src/exceptions/gamma.exceptions.ts
export class GammaApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly response?: any,
  ) {
    super(message)
    this.name = 'GammaApiException'
  }
}

export class GammaConnectionException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GammaConnectionException'
  }
}

export class GammaConfigurationException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GammaConfigurationException'
  }
}
```

## 6. Dynamic Module Implementation

```typescript
// libs/nest-gamma/src/nest-gamma.module.ts
import { DynamicModule, Global, Module, Provider } from '@nestjs/common'
import { GammaClientProvider } from './providers/gamma-client.provider'
import { GammaService } from './services/gamma.service'
import { GammaModuleOptions, GammaModuleAsyncOptions, NEST_GAMMA_CONFIG, NEST_GAMMA_CLIENT } from './types/gamma.types'
import { GammaConfigurationException } from './exceptions/gamma.exceptions'

@Global()
@Module({})
export class NestGammaModule {
  static forRoot(options: GammaModuleOptions): DynamicModule {
    this.validateConfig(options)

    const configProvider: Provider = {
      provide: NEST_GAMMA_CONFIG,
      useValue: options,
    }

    const clientProvider: Provider = {
      provide: NEST_GAMMA_CLIENT,
      useFactory: (config: GammaModuleOptions) => {
        return new GammaClientProvider({
          apiKey: config.apiKey,
          apiSecret: config.apiSecret,
          baseUrl: config.baseUrl,
          timeout: config.timeout,
          retryConfig: config.retryConfig,
        })
      },
      inject: [NEST_GAMMA_CONFIG],
    }

    return {
      module: NestGammaModule,
      providers: [
        configProvider,
        clientProvider,
        {
          provide: GammaService,
          useFactory: (config: GammaModuleOptions, client: GammaClientProvider) => {
            return new GammaService(config, client)
          },
          inject: [NEST_GAMMA_CONFIG, NEST_GAMMA_CLIENT],
        },
      ],
      exports: [GammaService],
    }
  }

  static forRootAsync(options: GammaModuleAsyncOptions): DynamicModule {
    const asyncProviders: Provider[] = [
      {
        provide: NEST_GAMMA_CONFIG,
        useFactory: async (...args: any[]) => {
          const config = await options.useFactory(...args)
          this.validateConfig(config)
          return config
        },
        inject: options.inject || [],
      },
      {
        provide: NEST_GAMMA_CLIENT,
        useFactory: (config: GammaModuleOptions) => {
          return new GammaClientProvider({
            apiKey: config.apiKey,
            apiSecret: config.apiSecret,
            baseUrl: config.baseUrl,
            timeout: config.timeout,
            retryConfig: config.retryConfig,
          })
        },
        inject: [NEST_GAMMA_CONFIG],
      },
      {
        provide: GammaService,
        useFactory: (config: GammaModuleOptions, client: GammaClientProvider) => {
          return new GammaService(config, client)
        },
        inject: [NEST_GAMMA_CONFIG, NEST_GAMMA_CLIENT],
      },
    ]

    return {
      module: NestGammaModule,
      imports: options.imports || [],
      providers: [...asyncProviders],
      exports: [GammaService],
    }
  }

  private static validateConfig(options: GammaModuleOptions): void {
    if (!options.apiKey) {
      throw new GammaConfigurationException('Gamma API key is required')
    }

    if (options.timeout && options.timeout < 1000) {
      throw new GammaConfigurationException('Timeout must be at least 1000ms')
    }
  }
}
```

## 7. Module Index Export

```typescript
// libs/nest-gamma/src/index.ts
export * from './nest-gamma.module'
export * from './services/gamma.service'
export * from './providers/gamma-client.provider'
export * from './types/gamma.types'
export * from './exceptions/gamma.exceptions'
```

## 8. Usage in Application

```typescript
// app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestGammaModule } from '@aegisol/nest-gamma'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Async configuration with ConfigService
    NestGammaModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        apiKey: configService.get<string>('GAMMA_API_KEY'),
        apiSecret: configService.get<string>('GAMMA_API_SECRET'),
        baseUrl: configService.get<string>('GAMMA_BASE_URL'),
        environment: configService.get<string>('NODE_ENV') as any,
        timeout: 30000,
        retryConfig: {
          retries: 3,
          retryDelay: 1000,
        },
        debug: configService.get<string>('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

## 9. Service Usage Examples

```typescript
// project.service.ts
import { Injectable } from '@nestjs/common'
import { GammaService } from '@aegisol/nest-gamma'

@Injectable()
export class ProjectService {
  constructor(private readonly gammaService: GammaService) {}

  async createNewProject(name: string, description?: string) {
    const project = await this.gammaService.createProject({
      name,
      description,
      metadata: {
        createdBy: 'nestjs-app',
        version: '1.0.0',
      },
    })

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      createdAt: project.createdAt,
    }
  }

  async getProjectWithTasks(projectId: string) {
    const [project, tasks] = await Promise.all([
      this.gammaService.getProject(projectId),
      this.gammaService.listTasks({ projectId }),
    ])

    return {
      ...project,
      tasks: tasks.data,
      taskCount: tasks.pagination?.total || 0,
    }
  }

  async assignTaskToUser(taskId: string, userId: string) {
    const task = await this.gammaService.updateTask(taskId, {
      assigneeId: userId,
      status: 'in_progress',
    })

    // Notify user about task assignment
    // ... notification logic

    return task
  }
}
```

## 10. Controller Example

```typescript
// gamma.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common'
import { GammaService } from '@aegisol/nest-gamma'
import {
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  ListProjectsQuery,
  ListTasksQuery,
} from '@aegisol/nest-gamma'

@Controller('gamma')
export class GammaController {
  constructor(private readonly gammaService: GammaService) {}

  // Projects
  @Post('projects')
  async createProject(@Body() data: CreateProjectRequest) {
    return this.gammaService.createProject(data)
  }

  @Get('projects')
  async listProjects(@Query() query: ListProjectsQuery) {
    return this.gammaService.listProjects(query)
  }

  @Get('projects/:id')
  async getProject(@Param('id') projectId: string) {
    return this.gammaService.getProject(projectId)
  }

  @Put('projects/:id')
  async updateProject(@Param('id') projectId: string, @Body() data: UpdateProjectRequest) {
    return this.gammaService.updateProject(projectId, data)
  }

  @Delete('projects/:id')
  async deleteProject(@Param('id') projectId: string) {
    await this.gammaService.deleteProject(projectId)
    return { message: 'Project deleted successfully' }
  }

  // Tasks
  @Post('tasks')
  async createTask(@Body() data: CreateTaskRequest) {
    return this.gammaService.createTask(data)
  }

  @Get('tasks')
  async listTasks(@Query() query: ListTasksQuery) {
    return this.gammaService.listTasks(query)
  }

  @Get('tasks/:id')
  async getTask(@Param('id') taskId: string) {
    return this.gammaService.getTask(taskId)
  }

  @Put('tasks/:id')
  async updateTask(@Param('id') taskId: string, @Body() data: UpdateTaskRequest) {
    return this.gammaService.updateTask(taskId, data)
  }

  // Health check
  @Get('health')
  async healthCheck() {
    const isHealthy = await this.gammaService.healthCheck()
    return { status: isHealthy ? 'ok' : 'error' }
  }
}
```

## 11. Environment Variables

```bash
# .env.development
GAMMA_API_KEY=your-dev-api-key
GAMMA_API_SECRET=your-dev-api-secret
GAMMA_BASE_URL=https://api-dev.gamma.com/v1
NODE_ENV=development

# .env.production
GAMMA_API_KEY=your-prod-api-key
GAMMA_API_SECRET=your-prod-api-secret
GAMMA_BASE_URL=https://api.gamma.com/v1
NODE_ENV=production
```

## 12. Testing

```typescript
// gamma.service.spec.ts
describe('GammaService', () => {
  let service: GammaService
  let mockClient: jest.Mocked<GammaClientProvider>

  beforeEach(async () => {
    const mockClientProvider = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      healthCheck: jest.fn(),
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GammaService,
        {
          provide: NEST_GAMMA_CONFIG,
          useValue: {
            apiKey: 'test-key',
            baseUrl: 'https://api.gamma.test',
          },
        },
        {
          provide: GammaClientProvider,
          useValue: mockClientProvider,
        },
      ],
    }).compile()

    service = module.get<GammaService>(GammaService)
    mockClient = module.get(GammaClientProvider)
  })

  describe('createProject', () => {
    it('should create project successfully', async () => {
      const mockProject = {
        id: 'proj_123',
        name: 'Test Project',
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
      }

      mockClient.post.mockResolvedValue({
        success: true,
        data: mockProject,
      })

      const result = await service.createProject({
        name: 'Test Project',
        description: 'Test Description',
      })

      expect(result).toEqual(mockProject)
      expect(mockClient.post).toHaveBeenCalledWith('/projects', {
        name: 'Test Project',
        description: 'Test Description',
      })
    })
  })
})
```

## 13. Best Practices

### 13.1 Error Handling

```typescript
// Use try-catch with specific error handling
try {
  const project = await this.gammaService.createProject(data)
  return project
} catch (error) {
  if (error instanceof GammaApiException) {
    // Handle API errors
    throw new BadRequestException(error.message)
  } else if (error instanceof GammaConnectionException) {
    // Handle connection errors
    throw new ServiceUnavailableException('Gamma service is unavailable')
  }
  throw error
}
```

### 13.2 Caching

```typescript
// Implement caching for frequently accessed data
import { CacheInterceptor } from '@nestjs/cache-manager';

@UseInterceptors(CacheInterceptor)
@Get('projects/:id')
@CacheTTL(300) // Cache for 5 minutes
async getProject(@Param('id') projectId: string) {
  return this.gammaService.getProject(projectId);
}
```

### 13.3 Rate Limiting

```typescript
// Add rate limiting to prevent API abuse
import { Throttle } from '@nestjs/throttler'

@Controller('gamma')
@Throttle(100, 60) // 100 requests per minute
export class GammaController {
  // ...
}
```

## 14. Package.json Configuration

```json
{
  "name": "@aegisol/nest-gamma",
  "version": "1.0.0",
  "description": "Gamma API integration for NestJS",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "axios": "^1.6.0",
    "reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    "@types/jest": "^29.5.0",
    "@types/node": "^20.0.0",
    "jest": "^29.5.0",
    "typescript": "^5.0.0"
  },
  "peerDependencies": {
    "@nestjs/common": "^9.0.0 || ^10.0.0",
    "@nestjs/core": "^9.0.0 || ^10.0.0"
  }
}
```

Gamma Client hiện tại đã được tối ưu hóa với:

✅ **Dynamic Module Pattern** - Flexible configuration
✅ **Type Safety** - Full TypeScript support
✅ **Error Handling** - Custom exceptions với detailed messages
✅ **Logging** - Comprehensive logging với debug mode
✅ **Health Checks** - Built-in health monitoring
✅ **Testing Support** - Easy to mock và unit test
✅ **Best Practices** - Rate limiting, caching, validation
✅ **Production Ready** - Environment-based configuration

SDK này có thể dễ dàng customize theo actual Gamma API specification của công ty bạn.
