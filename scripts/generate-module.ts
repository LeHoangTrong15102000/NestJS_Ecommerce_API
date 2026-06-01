#!/usr/bin/env ts-node
/**
 * Module Code Generator
 *
 * Scaffolds a complete NestJS module following this project's conventions.
 *
 * Usage:
 *   pnpm run generate:module <module-name>
 *   ts-node -r tsconfig-paths/register scripts/generate-module.ts <module-name>
 *
 * Example:
 *   pnpm run generate:module product-review
 *
 * Generated files:
 *   src/routes/<module-name>/
 *   ├── <module-name>.module.ts
 *   ├── <module-name>.controller.ts
 *   ├── <module-name>.service.ts
 *   ├── <module-name>.repo.ts
 *   ├── <module-name>.dto.ts
 *   ├── <module-name>.model.ts
 *   ├── <module-name>.error.ts
 *   └── __tests__/
 *       ├── <module-name>.controller.spec.ts
 *       ├── <module-name>.service.spec.ts
 *       └── <module-name>.repo.spec.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** kebab-case → PascalCase: "product-review" → "ProductReview" */
function toPascalCase(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** kebab-case → camelCase: "product-review" → "productReview" */
function toCamelCase(kebab: string): string {
  const pascal = toPascalCase(kebab)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

// ─── Templates ────────────────────────────────────────────────────────────────

function modelTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { z } from 'zod'

// ============================================
// ${Pascal.toUpperCase()} SCHEMAS
// ============================================

export const ${Pascal}Schema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type ${Pascal}Type = z.infer<typeof ${Pascal}Schema>

// ── Create ──────────────────────────────────

export const Create${Pascal}BodySchema = z.object({
  name: z.string().min(1).max(255),
})

export type Create${Pascal}BodyType = z.infer<typeof Create${Pascal}BodySchema>

// ── Update ──────────────────────────────────

export const Update${Pascal}BodySchema = Create${Pascal}BodySchema.partial()

export type Update${Pascal}BodyType = z.infer<typeof Update${Pascal}BodySchema>

// ── Params ──────────────────────────────────

export const ${Pascal}ParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export type ${Pascal}ParamsType = z.infer<typeof ${Pascal}ParamsSchema>

// ── List query ──────────────────────────────

export const Get${Pascal}ListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type Get${Pascal}ListQueryType = z.infer<typeof Get${Pascal}ListQuerySchema>

// ── List response ────────────────────────────

export const Get${Pascal}ListResSchema = z.object({
  data: z.array(${Pascal}Schema),
  totalItems: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
})

export type Get${Pascal}ListResType = z.infer<typeof Get${Pascal}ListResSchema>
`
}

function dtoTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { createZodDto } from 'nestjs-zod'
import {
  ${Pascal}Schema,
  Create${Pascal}BodySchema,
  Update${Pascal}BodySchema,
  ${Pascal}ParamsSchema,
  Get${Pascal}ListQuerySchema,
  Get${Pascal}ListResSchema,
} from 'src/routes/${name}/${name}.model'

export class ${Pascal}DTO extends createZodDto(${Pascal}Schema) {}

export class Create${Pascal}BodyDTO extends createZodDto(Create${Pascal}BodySchema) {}

export class Update${Pascal}BodyDTO extends createZodDto(Update${Pascal}BodySchema) {}

export class ${Pascal}ParamsDTO extends createZodDto(${Pascal}ParamsSchema) {}

export class Get${Pascal}ListQueryDTO extends createZodDto(Get${Pascal}ListQuerySchema) {}

export class Get${Pascal}ListResDTO extends createZodDto(Get${Pascal}ListResSchema) {}
`
}

function errorTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { NotFoundException, BadRequestException } from '@nestjs/common'

export const ${Pascal}NotFoundException = new NotFoundException('Error.${Pascal}NotFound')

export const ${Pascal}AlreadyExistsException = new BadRequestException('Error.${Pascal}AlreadyExists')
`
}

function repoTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  const camel = toCamelCase(name)
  return `import { Injectable } from '@nestjs/common'
import {
  ${Pascal}Type,
  Create${Pascal}BodyType,
  Update${Pascal}BodyType,
  Get${Pascal}ListQueryType,
  Get${Pascal}ListResType,
} from 'src/routes/${name}/${name}.model'
import { PrismaService } from 'src/shared/services/prisma.service'

@Injectable()
export class ${Pascal}Repo {
  constructor(private readonly prismaService: PrismaService) {}

  async findById(id: number): Promise<${Pascal}Type | null> {
    // TODO: replace '${camel}' with the actual Prisma model name from schema.prisma
    return (this.prismaService as any).${camel}.findUnique({
      where: { id, deletedAt: null },
    })
  }

  async findAll(query: Get${Pascal}ListQueryType): Promise<Get${Pascal}ListResType> {
    const { page, limit } = query
    const skip = (page - 1) * limit

    const [data, totalItems] = await Promise.all([
      (this.prismaService as any).${camel}.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prismaService as any).${camel}.count({ where: { deletedAt: null } }),
    ])

    return { data, totalItems, page, limit }
  }

  async create(data: Create${Pascal}BodyType): Promise<${Pascal}Type> {
    return (this.prismaService as any).${camel}.create({ data })
  }

  async update(id: number, data: Update${Pascal}BodyType): Promise<${Pascal}Type> {
    return (this.prismaService as any).${camel}.update({
      where: { id },
      data,
    })
  }

  async delete(id: number): Promise<void> {
    await (this.prismaService as any).${camel}.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
`
}

function serviceTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Injectable } from '@nestjs/common'
import {
  Create${Pascal}BodyType,
  Update${Pascal}BodyType,
  Get${Pascal}ListQueryType,
} from 'src/routes/${name}/${name}.model'
import { ${Pascal}Repo } from 'src/routes/${name}/${name}.repo'
import { ${Pascal}NotFoundException } from 'src/routes/${name}/${name}.error'

@Injectable()
export class ${Pascal}Service {
  constructor(private readonly ${name.replace(/-/g, '')}Repo: ${Pascal}Repo) {}

  async findAll(query: Get${Pascal}ListQueryType) {
    return this.${name.replace(/-/g, '')}Repo.findAll(query)
  }

  async findById(id: number) {
    const item = await this.${name.replace(/-/g, '')}Repo.findById(id)
    if (!item) throw ${Pascal}NotFoundException
    return item
  }

  async create(data: Create${Pascal}BodyType) {
    return this.${name.replace(/-/g, '')}Repo.create(data)
  }

  async update(id: number, data: Update${Pascal}BodyType) {
    await this.findById(id) // throws if not found
    return this.${name.replace(/-/g, '')}Repo.update(id, data)
  }

  async delete(id: number) {
    await this.findById(id) // throws if not found
    await this.${name.replace(/-/g, '')}Repo.delete(id)
    return { message: 'Deleted successfully' }
  }
}
`
}

function controllerTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import {
  ${Pascal}DTO,
  Create${Pascal}BodyDTO,
  Update${Pascal}BodyDTO,
  ${Pascal}ParamsDTO,
  Get${Pascal}ListQueryDTO,
  Get${Pascal}ListResDTO,
} from 'src/routes/${name}/${name}.dto'
import { ${Pascal}Service } from 'src/routes/${name}/${name}.service'
import { MessageResDTO } from 'src/shared/dtos/response.dto'

@Controller('${name}')
export class ${Pascal}Controller {
  constructor(private readonly ${name.replace(/-/g, '')}Service: ${Pascal}Service) {}

  /**
   * List all ${name}s
   * GET /${name}
   */
  @Get()
  @ZodResponse({ type: Get${Pascal}ListResDTO })
  async findAll(@Query() query: Get${Pascal}ListQueryDTO) {
    return this.${name.replace(/-/g, '')}Service.findAll(query)
  }

  /**
   * Get a single ${name} by ID
   * GET /${name}/:id
   */
  @Get(':id')
  @ZodResponse({ type: ${Pascal}DTO })
  async findById(@Param() params: ${Pascal}ParamsDTO) {
    return this.${name.replace(/-/g, '')}Service.findById(params.id)
  }

  /**
   * Create a new ${name}
   * POST /${name}
   */
  @Post()
  @ZodResponse({ type: ${Pascal}DTO })
  async create(@Body() body: Create${Pascal}BodyDTO) {
    return this.${name.replace(/-/g, '')}Service.create(body)
  }

  /**
   * Update a ${name}
   * PUT /${name}/:id
   */
  @Put(':id')
  @ZodResponse({ type: ${Pascal}DTO })
  async update(@Param() params: ${Pascal}ParamsDTO, @Body() body: Update${Pascal}BodyDTO) {
    return this.${name.replace(/-/g, '')}Service.update(params.id, body)
  }

  /**
   * Delete a ${name}
   * DELETE /${name}/:id
   */
  @Delete(':id')
  @ZodResponse({ type: MessageResDTO })
  async delete(@Param() params: ${Pascal}ParamsDTO) {
    return this.${name.replace(/-/g, '')}Service.delete(params.id)
  }
}
`
}

function moduleTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Module } from '@nestjs/common'
import { ${Pascal}Controller } from 'src/routes/${name}/${name}.controller'
import { ${Pascal}Service } from 'src/routes/${name}/${name}.service'
import { ${Pascal}Repo } from 'src/routes/${name}/${name}.repo'

@Module({
  providers: [${Pascal}Service, ${Pascal}Repo],
  controllers: [${Pascal}Controller],
  exports: [${Pascal}Service],
})
export class ${Pascal}Module {}
`
}

function controllerSpecTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Test, TestingModule } from '@nestjs/testing'
import { ${Pascal}Controller } from '../${name}.controller'
import { ${Pascal}Service } from '../${name}.service'

describe('${Pascal}Controller', () => {
  let controller: ${Pascal}Controller
  let mockService: jest.Mocked<${Pascal}Service>

  beforeEach(async () => {
    mockService = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<${Pascal}Service>

    const module: TestingModule = await Test.createTestingModule({
      controllers: [${Pascal}Controller],
      providers: [{ provide: ${Pascal}Service, useValue: mockService }],
    }).compile()

    controller = module.get<${Pascal}Controller>(${Pascal}Controller)
  })

  it('should be defined', () => {
    expect(controller).toBeDefined()
  })

  describe('findAll', () => {
    it('should return a list of ${name}s', async () => {
      const query = { page: 1, limit: 20 }
      const result = { data: [], totalItems: 0, page: 1, limit: 20 }
      mockService.findAll.mockResolvedValue(result)

      expect(await controller.findAll(query as any)).toEqual(result)
      expect(mockService.findAll).toHaveBeenCalledWith(query)
    })
  })

  describe('findById', () => {
    it('should return a single ${name}', async () => {
      const item = { id: 1, name: 'Test', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      mockService.findById.mockResolvedValue(item as any)

      expect(await controller.findById({ id: 1 } as any)).toEqual(item)
    })
  })

  describe('create', () => {
    it('should create a ${name}', async () => {
      const body = { name: 'New ${Pascal}' }
      const created = { id: 1, ...body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      mockService.create.mockResolvedValue(created as any)

      expect(await controller.create(body as any)).toEqual(created)
    })
  })

  describe('delete', () => {
    it('should delete a ${name}', async () => {
      mockService.delete.mockResolvedValue({ message: 'Deleted successfully' })

      expect(await controller.delete({ id: 1 } as any)).toEqual({ message: 'Deleted successfully' })
    })
  })
})
`
}

function serviceSpecTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Test, TestingModule } from '@nestjs/testing'
import { ${Pascal}Service } from '../${name}.service'
import { ${Pascal}Repo } from '../${name}.repo'
import { ${Pascal}NotFoundException } from '../${name}.error'

describe('${Pascal}Service', () => {
  let service: ${Pascal}Service
  let mockRepo: jest.Mocked<${Pascal}Repo>

  const create${Pascal} = (overrides = {}) => ({
    id: 1,
    name: 'Test ${Pascal}',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<${Pascal}Repo>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${Pascal}Service,
        { provide: ${Pascal}Repo, useValue: mockRepo },
      ],
    }).compile()

    service = module.get<${Pascal}Service>(${Pascal}Service)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('findById', () => {
    it('should return item when found', async () => {
      const item = create${Pascal}()
      mockRepo.findById.mockResolvedValue(item as any)

      expect(await service.findById(1)).toEqual(item)
    })

    it('should throw ${Pascal}NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null)

      await expect(service.findById(999)).rejects.toThrow(${Pascal}NotFoundException)
    })
  })

  describe('create', () => {
    it('should create and return item', async () => {
      const body = { name: 'New ${Pascal}' }
      const created = create${Pascal}(body)
      mockRepo.create.mockResolvedValue(created as any)

      expect(await service.create(body)).toEqual(created)
    })
  })

  describe('delete', () => {
    it('should delete item and return success message', async () => {
      const item = create${Pascal}()
      mockRepo.findById.mockResolvedValue(item as any)
      mockRepo.delete.mockResolvedValue(undefined)

      const result = await service.delete(1)
      expect(result).toEqual({ message: 'Deleted successfully' })
    })

    it('should throw when item not found', async () => {
      mockRepo.findById.mockResolvedValue(null)

      await expect(service.delete(999)).rejects.toThrow(${Pascal}NotFoundException)
    })
  })
})
`
}

function repoSpecTemplate(name: string): string {
  const Pascal = toPascalCase(name)
  return `import { Test, TestingModule } from '@nestjs/testing'
import { ${Pascal}Repo } from '../${name}.repo'
import { PrismaService } from 'src/shared/services/prisma.service'

describe('${Pascal}Repo', () => {
  let repo: ${Pascal}Repo
  let mockPrisma: jest.Mocked<PrismaService>

  beforeEach(async () => {
    mockPrisma = {
      // TODO: add mock for the Prisma model used in this repo
    } as unknown as jest.Mocked<PrismaService>

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ${Pascal}Repo,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()

    repo = module.get<${Pascal}Repo>(${Pascal}Repo)
  })

  it('should be defined', () => {
    expect(repo).toBeDefined()
  })

  // TODO: add tests for findById, findAll, create, update, delete
})
`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const moduleName = process.argv[2]

  if (!moduleName) {
    console.error('Usage: pnpm run generate:module <module-name>')
    console.error('Example: pnpm run generate:module product-review')
    process.exit(1)
  }

  // Validate: kebab-case only
  if (!/^[a-z][a-z0-9-]*$/.test(moduleName)) {
    console.error(`Invalid module name: "${moduleName}". Use kebab-case (e.g. "product-review").`)
    process.exit(1)
  }

  const moduleDir = path.resolve(__dirname, '../src/routes', moduleName)
  const testsDir = path.join(moduleDir, '__tests__')

  if (fs.existsSync(moduleDir)) {
    console.error(`Module directory already exists: ${moduleDir}`)
    process.exit(1)
  }

  fs.mkdirSync(moduleDir, { recursive: true })
  fs.mkdirSync(testsDir, { recursive: true })

  const files: Array<{ file: string; content: string }> = [
    { file: path.join(moduleDir, `${moduleName}.model.ts`), content: modelTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.dto.ts`), content: dtoTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.error.ts`), content: errorTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.repo.ts`), content: repoTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.service.ts`), content: serviceTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.controller.ts`), content: controllerTemplate(moduleName) },
    { file: path.join(moduleDir, `${moduleName}.module.ts`), content: moduleTemplate(moduleName) },
    { file: path.join(testsDir, `${moduleName}.controller.spec.ts`), content: controllerSpecTemplate(moduleName) },
    { file: path.join(testsDir, `${moduleName}.service.spec.ts`), content: serviceSpecTemplate(moduleName) },
    { file: path.join(testsDir, `${moduleName}.repo.spec.ts`), content: repoSpecTemplate(moduleName) },
  ]

  for (const { file, content } of files) {
    fs.writeFileSync(file, content, 'utf-8')
    const rel = file.replace(/\\/g, '/').replace(/.*src\//, 'src/')
    console.log(`  created  ${rel}`)
  }

  const Pascal = toPascalCase(moduleName)
  console.log(`
Module "${moduleName}" generated successfully.

Next steps:
  1. Add the Prisma model to prisma/schema.prisma
  2. Run: pnpm exec prisma migrate dev --name add-${moduleName}
  3. Update ${moduleName}.repo.ts — replace (this.prismaService as any).${moduleName.replace(/-/g, '')} with the actual Prisma model accessor
  4. Register ${Pascal}Module in src/app.module.ts imports array
  5. Add i18n keys for Error.${Pascal}NotFound and Error.${Pascal}AlreadyExists in src/i18n/
`)
}

main()
