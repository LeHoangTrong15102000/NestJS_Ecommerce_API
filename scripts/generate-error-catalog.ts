#!/usr/bin/env ts-node
/**
 * Error Catalog Generator
 *
 * Scans all *.error.ts files in src/ and extracts error codes, HTTP status codes,
 * and messages. Outputs:
 *   - docs/error-catalog.md  (human-readable)
 *   - docs/error-catalog.json (machine-readable)
 *
 * Usage:
 *   pnpm run docs:errors
 *   ts-node -r tsconfig-paths/register scripts/generate-error-catalog.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorEntry {
  name: string
  message: string
  httpStatus: number
  errorCode: string
  path?: string
  module: string
  file: string
}

interface ModuleErrors {
  module: string
  file: string
  errors: ErrorEntry[]
}

// ─── HTTP Status helpers ───────────────────────────────────────────────────────

const HTTP_STATUS_MAP: Record<string, number> = {
  UnprocessableEntityException: 422,
  UnauthorizedException: 401,
  ForbiddenException: 403,
  NotFoundException: 404,
  BadRequestException: 400,
  ConflictException: 409,
  InternalServerErrorException: 500,
  HttpException: 0, // resolved from second arg
}

function resolveHttpStatus(exceptionType: string, secondArg?: string): number {
  if (exceptionType === 'HttpException' && secondArg) {
    // HttpStatus.NOT_FOUND → 404, HttpStatus.BAD_REQUEST → 400, etc.
    const statusMatch = secondArg.match(/HttpStatus\.(\w+)/)
    if (statusMatch) {
      const statusName = statusMatch[1]
      const statusMap: Record<string, number> = {
        OK: 200,
        CREATED: 201,
        BAD_REQUEST: 400,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403,
        NOT_FOUND: 404,
        CONFLICT: 409,
        UNPROCESSABLE_ENTITY: 422,
        INTERNAL_SERVER_ERROR: 500,
      }
      return statusMap[statusName] ?? 0
    }
    // Numeric literal
    const numMatch = secondArg.match(/\b(\d{3})\b/)
    if (numMatch) return parseInt(numMatch[1], 10)
  }
  return HTTP_STATUS_MAP[exceptionType] ?? 0
}

// ─── File scanner ─────────────────────────────────────────────────────────────

function deriveModuleName(filePath: string): string {
  // e.g. src/routes/auth/auth.error.ts → auth
  //      src/routes/brand/brand-translation/brand-translation.error.ts → brand-translation
  //      src/shared/error.ts → shared
  const parts = filePath.replace(/\\/g, '/').split('/')
  const fileName = parts[parts.length - 1].replace('.error.ts', '').replace('.ts', '')
  if (fileName === 'error') return 'shared'
  return fileName
}

/**
 * Strip line comments (//) and block comments (/* *\/) from TypeScript source
 * so that regex patterns don't match commented-out exports.
 * Preserves line count (replaces comment text with spaces) to keep offsets stable,
 * though we don't rely on offsets here — we just need the text gone.
 */
function stripComments(source: string): string {
  // Remove block comments /* ... */ (non-greedy, dotAll)
  let result = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
  // Remove line comments // ... (to end of line)
  result = result.replace(/\/\/[^\n]*/g, '')
  return result
}

function parseErrorFile(filePath: string): ErrorEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const content = stripComments(raw)
  const moduleName = deriveModuleName(filePath)
  const relPath = filePath.replace(/\\/g, '/').replace(/.*src\//, 'src/')
  const entries: ErrorEntry[] = []

  // ── Pattern 1: export const XxxException = new SomeException([{ message, path }])
  // e.g. export const InvalidOTPException = new UnprocessableEntityException([{ message: 'Error.InvalidOTP', path: 'code' }])
  const arrayExceptionRegex = /export\s+const\s+(\w+)\s*=\s*new\s+(\w+Exception)\s*\(\s*\[([^\]]*)\]/gs
  let match: RegExpExecArray | null
  while ((match = arrayExceptionRegex.exec(content)) !== null) {
    const exportName = match[1]
    const exceptionType = match[2]
    const arrayContent = match[3]
    const httpStatus = resolveHttpStatus(exceptionType)

    // Extract all { message: '...', path: '...' } objects from the array
    const itemRegex = /\{[^}]*message\s*:\s*['"`]([^'"`]+)['"`][^}]*(?:path\s*:\s*['"`]([^'"`]*)['"`])?[^}]*\}/gs
    let itemMatch: RegExpExecArray | null
    const messages: Array<{ message: string; path?: string }> = []
    while ((itemMatch = itemRegex.exec(arrayContent)) !== null) {
      messages.push({ message: itemMatch[1], path: itemMatch[2] || undefined })
    }

    if (messages.length > 0) {
      entries.push({
        name: exportName,
        message: messages[0].message,
        httpStatus,
        errorCode: exportName,
        path: messages[0].path,
        module: moduleName,
        file: relPath,
      })
    }
  }

  // ── Pattern 2: export const XxxException = new SomeException('Error.Code')
  // e.g. export const RefreshTokenAlreadyUsedException = new UnauthorizedException('Error.RefreshTokenAlreadyUsed')
  const stringExceptionRegex = /export\s+const\s+(\w+)\s*=\s*new\s+(\w+Exception)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
  while ((match = stringExceptionRegex.exec(content)) !== null) {
    const exportName = match[1]
    const exceptionType = match[2]
    const message = match[3]
    const httpStatus = resolveHttpStatus(exceptionType)

    // Skip if already captured by array pattern
    if (!entries.find((e) => e.name === exportName)) {
      entries.push({
        name: exportName,
        message,
        httpStatus,
        errorCode: exportName,
        module: moduleName,
        file: relPath,
      })
    }
  }

  // ── Pattern 3: export const XxxException = new HttpException({ statusCode, message, error }, HttpStatus.XXX)
  // e.g. export const WishlistItemNotFoundException = new HttpException({ statusCode: HttpStatus.NOT_FOUND, message: 'Wishlist item not found', error: 'WISHLIST_ITEM_NOT_FOUND' }, HttpStatus.NOT_FOUND)
  const httpExceptionRegex =
    /export\s+const\s+(\w+)\s*=\s*new\s+HttpException\s*\(\s*\{([^}]+)\}\s*,\s*(HttpStatus\.\w+|\d+)\s*,?\s*\)/gs
  while ((match = httpExceptionRegex.exec(content)) !== null) {
    const exportName = match[1]
    const bodyContent = match[2]
    const secondArg = match[3]
    const httpStatus = resolveHttpStatus('HttpException', secondArg)

    const messageMatch = bodyContent.match(/message\s*:\s*['"`]([^'"`]+)['"`]/)
    const errorMatch = bodyContent.match(/error\s*:\s*['"`]([^'"`]+)['"`]/)

    if (messageMatch && !entries.find((e) => e.name === exportName)) {
      entries.push({
        name: exportName,
        message: messageMatch[1],
        httpStatus,
        errorCode: errorMatch ? errorMatch[1] : exportName,
        module: moduleName,
        file: relPath,
      })
    }
  }

  // ── Pattern 4: export const MODULE_ERRORS = { KEY: createErrorObject({ message, statusCode, errorCode }) }
  // e.g. ADDRESS_ERRORS = { ADDRESS_NOT_FOUND: createErrorObject({ message: '...', statusCode: HttpStatus.NOT_FOUND, errorCode: 'ADDRESS_NOT_FOUND' }) }
  const errorObjectRegex = /(\w+)\s*:\s*createErrorObject\s*\(\s*\{([^}]+)\}\s*\)/gs
  while ((match = errorObjectRegex.exec(content)) !== null) {
    const keyName = match[1]
    const objContent = match[2]

    const messageMatch = objContent.match(/message\s*:\s*['"`]([^'"`]+)['"`]/)
    const errorCodeMatch = objContent.match(/errorCode\s*:\s*['"`]([^'"`]+)['"`]/)
    const statusCodeMatch = objContent.match(/statusCode\s*:\s*(?:HttpStatus\.)?(\w+)/)

    if (messageMatch && errorCodeMatch) {
      let httpStatus = 0
      if (statusCodeMatch) {
        const statusVal = statusCodeMatch[1]
        const statusMap: Record<string, number> = {
          OK: 200,
          CREATED: 201,
          BAD_REQUEST: 400,
          UNAUTHORIZED: 401,
          FORBIDDEN: 403,
          NOT_FOUND: 404,
          CONFLICT: 409,
          UNPROCESSABLE_ENTITY: 422,
          INTERNAL_SERVER_ERROR: 500,
        }
        httpStatus = statusMap[statusVal] ?? (parseInt(statusVal, 10) || 0)
      }

      const entryName = `${moduleName.toUpperCase().replace(/-/g, '_')}_ERRORS.${keyName}`
      if (!entries.find((e) => e.errorCode === errorCodeMatch[1])) {
        entries.push({
          name: entryName,
          message: messageMatch[1],
          httpStatus,
          errorCode: errorCodeMatch[1],
          module: moduleName,
          file: relPath,
        })
      }
    }
  }

  return entries
}

// ─── Find all error files ──────────────────────────────────────────────────────

function findErrorFiles(dir: string): string[] {
  const results: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...findErrorFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.error.ts')) {
      results.push(fullPath)
    }
  }
  // Also include src/shared/error.ts
  return results
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const srcDir = path.resolve(__dirname, '../src')
  const docsDir = path.resolve(__dirname, '../docs')

  // Find all *.error.ts files
  const errorFiles = findErrorFiles(srcDir)

  // Also include src/shared/error.ts (not named *.error.ts)
  const sharedErrorFile = path.join(srcDir, 'shared', 'error.ts')
  if (fs.existsSync(sharedErrorFile) && !errorFiles.includes(sharedErrorFile)) {
    errorFiles.push(sharedErrorFile)
  }

  console.log(`Found ${errorFiles.length} error files`)

  // Parse all files
  const allModules: ModuleErrors[] = []
  for (const file of errorFiles) {
    const errors = parseErrorFile(file)
    if (errors.length > 0) {
      const moduleName = deriveModuleName(file)
      const existing = allModules.find((m) => m.module === moduleName)
      if (existing) {
        existing.errors.push(...errors)
      } else {
        allModules.push({
          module: moduleName,
          file: file.replace(/\\/g, '/').replace(/.*src\//, 'src/'),
          errors,
        })
      }
    }
  }

  // Sort modules alphabetically
  allModules.sort((a, b) => a.module.localeCompare(b.module))

  const totalErrors = allModules.reduce((sum, m) => sum + m.errors.length, 0)
  console.log(`Extracted ${totalErrors} error entries across ${allModules.length} modules`)

  // ── Generate Markdown ──────────────────────────────────────────────────────

  const mdLines: string[] = [
    '# Error Catalog',
    '',
    `> Auto-generated on ${new Date().toISOString().split('T')[0]} from \`*.error.ts\` files.`,
    `> Run \`pnpm run docs:errors\` to regenerate.`,
    '',
    `**Total errors:** ${totalErrors} across ${allModules.length} modules`,
    '',
    '## Table of Contents',
    '',
  ]

  for (const mod of allModules) {
    const anchor = mod.module.toLowerCase().replace(/[^a-z0-9]/g, '-')
    mdLines.push(`- [${mod.module}](#${anchor}) (${mod.errors.length} errors)`)
  }

  mdLines.push('')

  for (const mod of allModules) {
    mdLines.push(`## ${mod.module}`)
    mdLines.push('')
    mdLines.push(`Source: \`${mod.file}\``)
    mdLines.push('')
    mdLines.push('| Export Name | Error Code | HTTP Status | Message |')
    mdLines.push('|-------------|-----------|-------------|---------|')

    for (const err of mod.errors) {
      const statusLabel = err.httpStatus > 0 ? String(err.httpStatus) : '—'
      const safeMessage = err.message.replace(/\|/g, '\\|')
      mdLines.push(`| \`${err.name}\` | \`${err.errorCode}\` | ${statusLabel} | ${safeMessage} |`)
    }

    mdLines.push('')
  }

  const mdContent = mdLines.join('\n')
  fs.writeFileSync(path.join(docsDir, 'error-catalog.md'), mdContent, 'utf-8')
  console.log('Written: docs/error-catalog.md')

  // ── Generate JSON ──────────────────────────────────────────────────────────

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    totalErrors,
    modules: allModules.map((mod) => ({
      module: mod.module,
      file: mod.file,
      errors: mod.errors.map((err) => ({
        name: err.name,
        errorCode: err.errorCode,
        httpStatus: err.httpStatus,
        message: err.message,
        ...(err.path ? { path: err.path } : {}),
      })),
    })),
  }

  fs.writeFileSync(path.join(docsDir, 'error-catalog.json'), JSON.stringify(jsonOutput, null, 2), 'utf-8')
  console.log('Written: docs/error-catalog.json')
}

main()
