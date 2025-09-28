# Complete Google Gemini AI Integration Guide for NestJS

## Mục Lục

1. [Tổng Quan về Google Gemini AI](#1-tổng-quan-về-google-gemini-ai)
2. [Setup Google AI Studio & API Key](#2-setup-google-ai-studio--api-key)
3. [Cấu Trúc SDK cho NestJS](#3-cấu-trúc-sdk-cho-nestjs)
4. [Implementation Dynamic Module Pattern](#4-implementation-dynamic-module-pattern)
5. [Các Use Cases Thực Tế](#5-các-use-cases-thực-tế)
6. [Testing và Best Practices](#6-testing-và-best-practices)

## 1. Tổng Quan về Google Gemini AI

### Google Gemini AI là gì?

Google Gemini là một multimodal AI model có thể xử lý:

- **Text Generation**: Tạo văn bản từ prompts
- **Multimodal Input**: Xử lý text, images, audio, video
- **Code Generation**: Tạo và phân tích code
- **Conversation**: Chat và dialogue systems
- **Content Analysis**: Phân tích và tóm tắt nội dung

### Core Features cần tích hợp:

```
1. Text Generation (generateContent)
2. Streaming Generation (streamGenerateContent)
3. Chat Conversations (generateContent với history)
4. Multimodal Processing (text + images)
5. Function Calling
6. Content Moderation
```

### API Endpoints của Gemini:

**Base URL**: `https://generativelanguage.googleapis.com/v1beta`

**Chính thức các endpoints:**

- `/models` - List available models
- `/models/{modelId}` - Get model details
- `/models/{modelId}:generateContent` - Generate content
- `/models/{modelId}:streamGenerateContent` - Stream content
- `/models/{modelId}:countTokens` - Count tokens
- `/models/{modelId}:embedContent` - Generate embeddings
- `/models/{modelId}:batchEmbedContents` - Batch embeddings
- `/models/{modelId}:predict` - Prediction requests
- `/models/{modelId}:predictLongRunning` - Long running predictions
- `/files` - File management
- `/files/{fileId}` - File operations

## 2. Setup Google AI Studio & API Key

### Bước 1: Tạo Google AI Studio Account

1. Truy cập [https://aistudio.google.com](https://aistudio.google.com)
2. Đăng nhập bằng Google Account
3. Accept Terms of Service

### Bước 2: Lấy API Key

#### 2.1 Tạo API Key

```bash
AI Studio → Get API Key → Create API Key → Create API Key in new project
```

Bạn sẽ nhận được:

```json
{
  "API_KEY": "AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

⚠️ **Important**: API key này là free tier với giới hạn:

- 15 requests per minute
- 1 million tokens per minute
- 1,500 requests per day

#### 2.2 Cấu hình Environment Variables

```bash
# .env
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash
```

### Bước 3: Test API Key

```bash
curl \
  -H 'x-goog-api-key: YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Write a story about AI"}]}]}' \
  -X POST 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
```

## 3. Cấu Trúc SDK cho NestJS

### 3.1 Cài đặt Dependencies

```bash
# Core dependencies
npm install @google/generative-ai axios

# Development dependencies
npm install --save-dev @types/node
```

### 3.2 Tạo Module Structure

```
libs/
└── nest-gemini/
    ├── src/
    │   ├── index.ts
    │   ├── nest-gemini.module.ts
    │   ├── nest-gemini.service.ts
    │   ├── types/
    │   │   ├── index.ts
    │   │   ├── gemini.types.ts
    │   │   └── openapi.types.ts
    │   ├── services/
    │   │   ├── gemini-text.service.ts
    │   │   ├── gemini-chat.service.ts
    │   │   ├── gemini-multimodal.service.ts
    │   │   └── gemini-function.service.ts
    │   ├── utils/
    │   │   ├── oas.yml
    │   │   └── providers.ts
    │   └── guards/
    │       └── rate-limit.guard.ts
    ├── package.json
    └── README.md
```

## 4. Implementation Dynamic Module Pattern

### 4.1 OpenAPI Specification

```yaml
# libs/nest-gemini/src/utils/oas.yml
openapi: 3.0.3
info:
  title: Google Gemini AI API
  version: v1beta
  description: |
    The Google Gemini AI API allows you to integrate Google's most capable multimodal AI model into your applications.

    **Base URL**: https://generativelanguage.googleapis.com/v1beta

    **Authentication**: Include your API key in the `x-goog-api-key` header

    **Rate Limits**: 
    - 15 requests per minute (free tier)
    - 1 million tokens per minute
    - 1,500 requests per day

servers:
  - url: https://generativelanguage.googleapis.com/v1beta
    description: Production server

security:
  - ApiKeyAuth: []

paths:
  /models:
    get:
      tags:
        - Models
      operationId: listModels
      summary: List Models
      description: List all available Gemini models
      parameters:
        - name: pageSize
          in: query
          required: false
          schema:
            type: integer
            default: 50
        - name: pageToken
          in: query
          required: false
          schema:
            type: string
      responses:
        '200':
          description: Models retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ListModelsResponse'
        '401':
          description: Unauthorized - Invalid API key
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /models/{modelId}:
    get:
      tags:
        - Models
      operationId: getModel
      summary: Get Model
      description: Get details about a specific model
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID (e.g., gemini-1.5-flash)
      responses:
        '200':
          description: Model details retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Model'

  /models/{modelId}:generateContent:
    post:
      tags:
        - Generation
      operationId: generateContent
      summary: Generate Content
      description: Generate content using the specified model
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID (e.g., gemini-1.5-flash)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GenerateContentRequest'
      responses:
        '200':
          description: Content generated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GenerateContentResponse'

  /models/{modelId}:streamGenerateContent:
    post:
      tags:
        - Generation
      operationId: streamGenerateContent
      summary: Stream Generate Content
      description: Generate content with streaming response
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/GenerateContentRequest'
      responses:
        '200':
          description: Streaming response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/GenerateContentResponse'

  /models/{modelId}:countTokens:
    post:
      tags:
        - Tokens
      operationId: countTokens
      summary: Count Tokens
      description: Count tokens in the input
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CountTokensRequest'
      responses:
        '200':
          description: Token count retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CountTokensResponse'

  /models/{modelId}:embedContent:
    post:
      tags:
        - Embeddings
      operationId: embedContent
      summary: Embed Content
      description: Generate embeddings for the input content
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID (use embedding models like text-embedding-004)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EmbedContentRequest'
      responses:
        '200':
          description: Embeddings generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/EmbedContentResponse'

  /models/{modelId}:batchEmbedContents:
    post:
      tags:
        - Embeddings
      operationId: batchEmbedContents
      summary: Batch Embed Contents
      description: Generate embeddings for multiple contents in a batch
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID (use embedding models like text-embedding-004)
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BatchEmbedContentsRequest'
      responses:
        '200':
          description: Batch embeddings generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BatchEmbedContentsResponse'

  /models/{modelId}:predict:
    post:
      tags:
        - Prediction
      operationId: predict
      summary: Predict
      description: Performs a prediction request
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PredictRequest'
      responses:
        '200':
          description: Prediction completed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PredictResponse'

  /models/{modelId}:predictLongRunning:
    post:
      tags:
        - Prediction
      operationId: predictLongRunning
      summary: Predict Long Running
      description: Same as models.predict but returns an LRO
      parameters:
        - name: modelId
          in: path
          required: true
          schema:
            type: string
          description: Model ID
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PredictRequest'
      responses:
        '200':
          description: Long running operation started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Operation'

  # FILES API
  /files:
    get:
      tags:
        - Files
      operationId: listFiles
      summary: List Files
      description: Lists the metadata for Files owned by the requesting project
      parameters:
        - name: pageSize
          in: query
          required: false
          schema:
            type: integer
            maximum: 100
            default: 10
          description: Maximum number of Files to return per page
        - name: pageToken
          in: query
          required: false
          schema:
            type: string
          description: The page token from the previous response
      responses:
        '200':
          description: Files retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ListFilesResponse'

    post:
      tags:
        - Files
      operationId: createFile
      summary: Create File
      description: Creates a File
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                metadata:
                  type: string
                  description: JSON metadata for the file
                file:
                  type: string
                  format: binary
                  description: The file to upload
      responses:
        '200':
          description: File created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileResponse'

  /files/{fileId}:
    get:
      tags:
        - Files
      operationId: getFile
      summary: Get File
      description: Gets the metadata for the given File
      parameters:
        - name: fileId
          in: path
          required: true
          schema:
            type: string
          description: The File ID
      responses:
        '200':
          description: File metadata retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/FileResponse'

    delete:
      tags:
        - Files
      operationId: deleteFile
      summary: Delete File
      description: Deletes the File
      parameters:
        - name: fileId
          in: path
          required: true
          schema:
            type: string
          description: The File ID
      responses:
        '200':
          description: File deleted successfully

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: x-goog-api-key

  schemas:
    # MODELS
    ListModelsResponse:
      type: object
      properties:
        models:
          type: array
          items:
            $ref: '#/components/schemas/Model'
        nextPageToken:
          type: string

    Model:
      type: object
      properties:
        name:
          type: string
          example: 'models/gemini-1.5-flash-001'
          description: The resource name of the Model
        baseModelId:
          type: string
          example: 'gemini-1.5-flash'
          description: The name of the base model, pass this to the generation request
        version:
          type: string
          example: '001'
          description: The version number of the model
        displayName:
          type: string
          example: 'Gemini 1.5 Flash'
          description: The human-readable name of the model
        description:
          type: string
          description: A short description of the model
        inputTokenLimit:
          type: integer
          description: Maximum number of input tokens allowed for this model
        outputTokenLimit:
          type: integer
          description: Maximum number of output tokens available for this model
        supportedGenerationMethods:
          type: array
          items:
            type: string
          description: The model's supported generation methods
          example: ['generateContent', 'streamGenerateContent', 'countTokens']
        thinking:
          type: boolean
          description: Whether the model supports thinking
        temperature:
          type: number
          format: float
          description: Controls the randomness of the output
        maxTemperature:
          type: number
          format: float
          description: The maximum temperature this model can use
        topP:
          type: number
          format: float
          description: For Nucleus sampling
        topK:
          type: integer
          description: For Top-k sampling

    # GENERATION
    GenerateContentRequest:
      type: object
      required:
        - contents
      properties:
        contents:
          type: array
          items:
            $ref: '#/components/schemas/Content'
        tools:
          type: array
          items:
            $ref: '#/components/schemas/Tool'
        toolConfig:
          $ref: '#/components/schemas/ToolConfig'
        safetySettings:
          type: array
          items:
            $ref: '#/components/schemas/SafetySetting'
        systemInstruction:
          $ref: '#/components/schemas/Content'
        generationConfig:
          $ref: '#/components/schemas/GenerationConfig'

    GenerateContentResponse:
      type: object
      properties:
        candidates:
          type: array
          items:
            $ref: '#/components/schemas/Candidate'
        promptFeedback:
          $ref: '#/components/schemas/PromptFeedback'
        usageMetadata:
          $ref: '#/components/schemas/UsageMetadata'

    Content:
      type: object
      required:
        - parts
      properties:
        parts:
          type: array
          items:
            $ref: '#/components/schemas/Part'
        role:
          type: string
          enum: [user, model, function]
          description: Role of the content author

    Part:
      type: object
      oneOf:
        - $ref: '#/components/schemas/TextPart'
        - $ref: '#/components/schemas/InlineDataPart'
        - $ref: '#/components/schemas/FileDataPart'
        - $ref: '#/components/schemas/FunctionCallPart'
        - $ref: '#/components/schemas/FunctionResponsePart'

    TextPart:
      type: object
      required:
        - text
      properties:
        text:
          type: string
          example: 'Write a story about AI'

    InlineDataPart:
      type: object
      required:
        - inlineData
      properties:
        inlineData:
          $ref: '#/components/schemas/Blob'

    FileDataPart:
      type: object
      required:
        - fileData
      properties:
        fileData:
          $ref: '#/components/schemas/FileData'

    FunctionCallPart:
      type: object
      required:
        - functionCall
      properties:
        functionCall:
          $ref: '#/components/schemas/FunctionCall'

    FunctionResponsePart:
      type: object
      required:
        - functionResponse
      properties:
        functionResponse:
          $ref: '#/components/schemas/FunctionResponse'

    Blob:
      type: object
      required:
        - mimeType
        - data
      properties:
        mimeType:
          type: string
          example: 'image/jpeg'
        data:
          type: string
          format: base64
          description: Base64 encoded data

    FileData:
      type: object
      required:
        - mimeType
        - fileUri
      properties:
        mimeType:
          type: string
        fileUri:
          type: string

    Candidate:
      type: object
      properties:
        content:
          $ref: '#/components/schemas/Content'
        finishReason:
          type: string
          enum: [FINISH_REASON_UNSPECIFIED, STOP, MAX_TOKENS, SAFETY, RECITATION, OTHER]
        index:
          type: integer
        safetyRatings:
          type: array
          items:
            $ref: '#/components/schemas/SafetyRating'
        citationMetadata:
          $ref: '#/components/schemas/CitationMetadata'
        tokenCount:
          type: integer

    GenerationConfig:
      type: object
      properties:
        stopSequences:
          type: array
          items:
            type: string
        responseMimeType:
          type: string
          enum: [text/plain, application/json]
          default: text/plain
        responseSchema:
          type: object
        candidateCount:
          type: integer
          minimum: 1
        maxOutputTokens:
          type: integer
        temperature:
          type: number
          format: float
          minimum: 0.0
          maximum: 2.0
        topP:
          type: number
          format: float
        topK:
          type: integer

    SafetySetting:
      type: object
      required:
        - category
        - threshold
      properties:
        category:
          type: string
          enum:
            [
              HARM_CATEGORY_HARASSMENT,
              HARM_CATEGORY_HATE_SPEECH,
              HARM_CATEGORY_SEXUALLY_EXPLICIT,
              HARM_CATEGORY_DANGEROUS_CONTENT,
            ]
        threshold:
          type: string
          enum:
            [HARM_BLOCK_THRESHOLD_UNSPECIFIED, BLOCK_LOW_AND_ABOVE, BLOCK_MEDIUM_AND_ABOVE, BLOCK_ONLY_HIGH, BLOCK_NONE]

    SafetyRating:
      type: object
      properties:
        category:
          type: string
        probability:
          type: string
          enum: [NEGLIGIBLE, LOW, MEDIUM, HIGH]
        blocked:
          type: boolean

    # TOOLS & FUNCTIONS
    Tool:
      type: object
      properties:
        functionDeclarations:
          type: array
          items:
            $ref: '#/components/schemas/FunctionDeclaration'

    FunctionDeclaration:
      type: object
      required:
        - name
        - description
      properties:
        name:
          type: string
          example: 'get_weather'
        description:
          type: string
          example: 'Get current weather for a location'
        parameters:
          type: object
          description: JSON Schema for function parameters

    FunctionCall:
      type: object
      required:
        - name
        - args
      properties:
        name:
          type: string
        args:
          type: object

    FunctionResponse:
      type: object
      required:
        - name
        - response
      properties:
        name:
          type: string
        response:
          type: object

    ToolConfig:
      type: object
      properties:
        functionCallingConfig:
          $ref: '#/components/schemas/FunctionCallingConfig'

    FunctionCallingConfig:
      type: object
      properties:
        mode:
          type: string
          enum: [MODE_UNSPECIFIED, AUTO, ANY, NONE]
          default: AUTO
        allowedFunctionNames:
          type: array
          items:
            type: string

    # TOKENS & EMBEDDINGS
    CountTokensRequest:
      type: object
      required:
        - contents
      properties:
        contents:
          type: array
          items:
            $ref: '#/components/schemas/Content'

    CountTokensResponse:
      type: object
      properties:
        totalTokens:
          type: integer

    EmbedContentRequest:
      type: object
      required:
        - content
      properties:
        content:
          $ref: '#/components/schemas/Content'
        taskType:
          type: string
          enum:
            [
              TASK_TYPE_UNSPECIFIED,
              RETRIEVAL_QUERY,
              RETRIEVAL_DOCUMENT,
              SEMANTIC_SIMILARITY,
              CLASSIFICATION,
              CLUSTERING,
            ]
        title:
          type: string

    EmbedContentResponse:
      type: object
      properties:
        embedding:
          $ref: '#/components/schemas/ContentEmbedding'

    BatchEmbedContentsRequest:
      type: object
      required:
        - requests
      properties:
        requests:
          type: array
          items:
            $ref: '#/components/schemas/EmbedContentRequest'

    BatchEmbedContentsResponse:
      type: object
      properties:
        embeddings:
          type: array
          items:
            $ref: '#/components/schemas/ContentEmbedding'

    ContentEmbedding:
      type: object
      properties:
        values:
          type: array
          items:
            type: number
            format: float

    # PREDICTION SCHEMAS
    PredictRequest:
      type: object
      required:
        - instances
      properties:
        instances:
          type: array
          items:
            type: object
          description: The instances that are the input to the prediction call
        parameters:
          type: object
          description: The parameters that govern the prediction call

    PredictResponse:
      type: object
      properties:
        predictions:
          type: array
          items:
            type: object
          description: The outputs of the prediction call

    # OPERATION SCHEMAS (for Long Running Operations)
    Operation:
      type: object
      properties:
        name:
          type: string
          description: The server-assigned name
        metadata:
          type: object
          description: Service-specific metadata associated with the operation
        done:
          type: boolean
          description: If the value is false, it means the operation is still in progress
        error:
          $ref: '#/components/schemas/Status'
        response:
          type: object
          description: The normal response of the operation if it was completed successfully

    # FILE SCHEMAS
    FileResponse:
      type: object
      properties:
        name:
          type: string
          description: The resource name of the File
          example: 'files/abc123'
        displayName:
          type: string
          description: The human-readable display name for the File
        mimeType:
          type: string
          description: MIME type of the file
        sizeBytes:
          type: string
          format: int64
          description: Size of the file in bytes
        createTime:
          type: string
          format: date-time
          description: The timestamp of when the File was created
        updateTime:
          type: string
          format: date-time
          description: The timestamp of when the File was last updated
        expirationTime:
          type: string
          format: date-time
          description: The timestamp of when the File will be deleted
        sha256Hash:
          type: string
          format: byte
          description: SHA-256 hash of the uploaded bytes
        uri:
          type: string
          description: The uri of the File
        state:
          type: string
          enum: [STATE_UNSPECIFIED, PROCESSING, ACTIVE, FAILED]
          description: Processing state of the File
        error:
          $ref: '#/components/schemas/Status'

    ListFilesResponse:
      type: object
      properties:
        files:
          type: array
          items:
            $ref: '#/components/schemas/FileResponse'
        nextPageToken:
          type: string
          description: A token which can be sent as pageToken to retrieve the next page

    # ERROR SCHEMAS
    Status:
      type: object
      properties:
        code:
          type: integer
          description: The status code
        message:
          type: string
          description: A developer-facing error message
        details:
          type: array
          items:
            type: object
          description: A list of messages that carry the error details

    ErrorResponse:
      type: object
      properties:
        error:
          $ref: '#/components/schemas/Status'
          description: Error details

    # METADATA
    PromptFeedback:
      type: object
      properties:
        blockReason:
          type: string
          enum: [BLOCK_REASON_UNSPECIFIED, SAFETY, OTHER]
        safetyRatings:
          type: array
          items:
            $ref: '#/components/schemas/SafetyRating'

    UsageMetadata:
      type: object
      properties:
        promptTokenCount:
          type: integer
        candidatesTokenCount:
          type: integer
        totalTokenCount:
          type: integer

    CitationMetadata:
      type: object
      properties:
        citationSources:
          type: array
          items:
            $ref: '#/components/schemas/CitationSource'

    CitationSource:
      type: object
      properties:
        startIndex:
          type: integer
        endIndex:
          type: integer
        uri:
          type: string
        license:
          type: string
```

### 4.2 Types Definition

```typescript
// libs/nest-gemini/src/types/gemini.types.ts
import { ModuleMetadata, Type } from '@nestjs/common'

export const NEST_GEMINI_CONFIG = Symbol('NEST_GEMINI_CONFIG')
export const NEST_GEMINI_CLIENT = Symbol('NEST_GEMINI_CLIENT')

export interface GeminiModuleOptions {
  apiKey: string
  baseUrl?: string
  defaultModel?: string
  options?: {
    timeout?: number
    retryConfig?: {
      retries?: number
      retryDelay?: number
    }
    rateLimiting?: {
      enabled: boolean
      maxRequests: number
      windowMs: number
    }
  }
}

export interface GeminiModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  name?: string
  useFactory: (...args: any[]) => Promise<GeminiModuleOptions> | GeminiModuleOptions
  inject?: any[]
}

// Content Types
export interface GeminiTextRequest {
  prompt: string
  options?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    safetySettings?: SafetySetting[]
    stopSequences?: string[]
  }
}

export interface GeminiMultimodalRequest {
  textPrompt: string
  media?: {
    type: 'image' | 'video' | 'audio'
    data: string | Buffer
    mimeType: string
  }[]
  options?: GeminiTextRequest['options']
}

export interface GeminiChatRequest {
  message: string
  history?: ChatHistory[]
  options?: GeminiTextRequest['options']
}

export interface ChatHistory {
  role: 'user' | 'model'
  parts: { text: string }[]
}

export interface GeminiFunctionRequest {
  prompt: string
  functions: FunctionDeclaration[]
  options?: GeminiTextRequest['options'] & {
    functionCallingMode?: 'AUTO' | 'ANY' | 'NONE'
    allowedFunctionNames?: string[]
  }
}

export interface SafetySetting {
  category:
    | 'HARM_CATEGORY_HARASSMENT'
    | 'HARM_CATEGORY_HATE_SPEECH'
    | 'HARM_CATEGORY_SEXUALLY_EXPLICIT'
    | 'HARM_CATEGORY_DANGEROUS_CONTENT'
  threshold: 'BLOCK_LOW_AND_ABOVE' | 'BLOCK_MEDIUM_AND_ABOVE' | 'BLOCK_ONLY_HIGH' | 'BLOCK_NONE'
}

export interface FunctionDeclaration {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

// Response Types
export interface GeminiResponse {
  candidates: {
    content: {
      parts: { text?: string; functionCall?: any }[]
      role: string
    }
    finishReason: string
    index: number
    safetyRatings: any[]
  }[]
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

export interface GeminiStreamResponse extends AsyncIterable<GeminiResponse> {}
```

### 4.3 Providers Implementation

```typescript
// libs/nest-gemini/src/utils/providers.ts
import { HttpService } from '@nestjs/axios'

@Injectable()
export class WeatherService {
  constructor(private readonly httpService: HttpService) {}

  async getCurrentWeather(args: { location: string; unit?: string }) {
    try {
      // Mock weather API call - replace with real weather service
      const { location, unit = 'celsius' } = args

      // Simulate API call
      const weatherData = {
        location,
        temperature: unit === 'celsius' ? 25 : 77,
        condition: 'sunny',
        humidity: 65,
        unit,
      }

      return weatherData
    } catch (error) {
      return { error: `Failed to get weather for ${args.location}` }
    }
  }
}

// apps/your-service/src/services/calculator.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class CalculatorService {
  evaluate(args: { expression: string }) {
    try {
      // Simple math evaluation - use a proper math parser in production
      const { expression } = args

      // Basic safety check
      if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
        throw new Error('Invalid expression')
      }

      const result = Function('"use strict"; return (' + expression + ')')()

      return {
        expression,
        result: Number(result),
        success: true,
      }
    } catch (error) {
      return {
        expression: args.expression,
        error: error.message,
        success: false,
      }
    }
  }
}
```

### 5.6 AI Assistant Service (Advanced Use Case)

```typescript
// apps/your-service/src/services/ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GeminiTextService, GeminiChatService, GeminiMultimodalService, GeminiFunctionService } from '@nnpp/nest-gemini'

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name)

  constructor(
    private readonly geminiTextService: GeminiTextService,
    private readonly geminiChatService: GeminiChatService,
    private readonly geminiMultimodalService: GeminiMultimodalService,
    private readonly geminiFunctionService: GeminiFunctionService,
  ) {}

  // Content generation for different purposes
  async generateMarketingCopy(product: any, tone: 'professional' | 'casual' | 'exciting') {
    const prompt = `Create marketing copy for the following product with a ${tone} tone:
    
Product Name: ${product.name}
Description: ${product.description}
Key Features: ${product.features.join(', ')}
Target Audience: ${product.targetAudience}

Generate:
1. A compelling headline
2. A 2-paragraph product description
3. 5 key selling points
4. A call-to-action

Format the response as JSON.`

    return await this.geminiTextService.generateStructuredContent(prompt, 'json')
  }

  // Code review and suggestions
  async reviewCode(code: string, language: string) {
    const prompt = `Review the following ${language} code and provide:
1. Overall code quality assessment (1-10)
2. Potential bugs or issues
3. Performance improvements
4. Best practice suggestions
5. Security considerations

Code:
\`\`\`${language}
${code}
\`\`\``

    return await this.geminiTextService.generateText({
      prompt,
      options: { temperature: 0.1 }, // Low temperature for technical accuracy
    })
  }

  // Smart document processing
  async processDocument(content: string, task: 'summarize' | 'extract_key_points' | 'translate' | 'analyze_sentiment') {
    let prompt: string

    switch (task) {
      case 'summarize':
        prompt = `Summarize the following document in 3-5 bullet points:\n\n${content}`
        break
      case 'extract_key_points':
        prompt = `Extract the main key points from this document and format them as a numbered list:\n\n${content}`
        break
      case 'translate':
        prompt = `Translate the following text to Vietnamese:\n\n${content}`
        break
      case 'analyze_sentiment':
        prompt = `Analyze the sentiment of this document and provide:
1. Overall sentiment (positive/negative/neutral)
2. Confidence score (0-100%)
3. Key emotional indicators
4. Brief explanation

Document:\n\n${content}`
        break
      default:
        throw new Error('Invalid task type')
    }

    return await this.geminiTextService.generateText({ prompt })
  }

  // Smart data analysis
  async analyzeBusinessData(data: any[], analysis_type: 'trends' | 'insights' | 'recommendations') {
    const dataString = JSON.stringify(data, null, 2)

    const prompt = `Analyze the following business data and provide ${analysis_type}:

Data:
${dataString}

Please provide:
1. Key observations
2. Important ${analysis_type}
3. Actionable recommendations
4. Potential concerns or opportunities

Format the response clearly and provide specific examples from the data.`

    return await this.geminiTextService.generateText({
      prompt,
      options: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    })
  }

  // Multi-modal content analysis
  async analyzeContentWithImages(text: string, images: Buffer[], imageTypes: string[]) {
    try {
      // Convert images to base64
      const imageData = images.map((buffer, index) => ({
        data: buffer.toString('base64'),
        mimeType: imageTypes[index],
      }))

      // For now, analyze text and first image separately
      const textAnalysis = await this.geminiTextService.generateText({
        prompt: `Analyze this text content: ${text}`,
      })

      let imageAnalysis = ''
      if (imageData.length > 0) {
        imageAnalysis = await this.geminiMultimodalService.analyzeImageFromBase64(
          imageData[0].data,
          imageData[0].mimeType,
          'Describe this image and how it relates to the text content',
        )
      }

      return {
        textAnalysis,
        imageAnalysis,
        combinedInsights: await this.geminiTextService.generateText({
          prompt: `Based on the text analysis: "${textAnalysis}" and image analysis: "${imageAnalysis}", provide combined insights about this content.`,
        }),
      }
    } catch (error) {
      this.logger.error('Failed to analyze multi-modal content:', error)
      throw error
    }
  }

  // Advanced chat with context and memory
  async smartChatWithContext(
    sessionId: string,
    message: string,
    context?: {
      userProfile?: any
      previousActions?: string[]
      currentProject?: any
    },
  ) {
    // Build context-aware prompt
    let systemInstruction = 'You are a helpful AI assistant.'

    if (context) {
      systemInstruction += ' Here is some context about the user and current session:'

      if (context.userProfile) {
        systemInstruction += `\nUser Profile: ${JSON.stringify(context.userProfile)}`
      }

      if (context.previousActions?.length) {
        systemInstruction += `\nRecent Actions: ${context.previousActions.join(', ')}`
      }

      if (context.currentProject) {
        systemInstruction += `\nCurrent Project: ${JSON.stringify(context.currentProject)}`
      }
    }

    // Start session if not exists
    if (!this.geminiChatService.getChatHistory(sessionId).length) {
      await this.geminiChatService.startChat(sessionId, systemInstruction)
    }

    return await this.geminiChatService.sendMessage(sessionId, message, {
      temperature: 0.7,
    })
  }
}
```

### 5.7 Rate Limiting Guard

```typescript
// libs/nest-gemini/src/guards/rate-limit.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

@Injectable()
export class GeminiRateLimitGuard implements CanActivate {
  private store: RateLimitStore = {}
  private readonly defaultLimit = 15 // Gemini free tier limit
  private readonly windowMs = 60 * 1000 // 1 minute

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const key = this.generateKey(request)

    const now = Date.now()
    const record = this.store[key]

    if (!record || now > record.resetTime) {
      this.store[key] = {
        count: 1,
        resetTime: now + this.windowMs,
      }
      return true
    }

    if (record.count >= this.defaultLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded for Gemini API',
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    record.count++
    return true
  }

  private generateKey(request: any): string {
    // Use IP address or user ID for rate limiting
    return request.ip || request.user?.id || 'anonymous'
  }
}
```

## 6. Testing và Best Practices

### 6.1 Unit Testing

```typescript
// libs/nest-gemini/src/nest-gemini.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { NestGeminiService } from './nest-gemini.service'
import { NestGeminiModule } from './nest-gemini.module'

describe('NestGeminiService', () => {
  let service: NestGeminiService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          envFilePath: '.env.test',
        }),
        NestGeminiModule.forRoot({
          apiKey: 'test-api-key',
          defaultModel: 'gemini-1.5-flash',
        }),
      ],
    }).compile()

    service = module.get<NestGeminiService>(NestGeminiService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // Integration tests (require real API key)
  describe('Integration Tests', () => {
    it('should list available models', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.log('Skipping integration test - no API key')
        return
      }

      const models = await service.listModels()
      expect(models).toBeDefined()
      expect(models.models).toBeInstanceOf(Array)
    })

    it('should generate text content', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.log('Skipping integration test - no API key')
        return
      }

      const result = await service.generateText({
        prompt: 'Write a short poem about artificial intelligence',
        options: {
          temperature: 0.7,
          maxOutputTokens: 100,
        },
      })

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
```

### 6.2 Integration Testing

```typescript
// e2e/gemini-integration.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'

describe('Gemini Integration (e2e)', () => {
  let app: INestApplication

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  it('/ai/content/generate-text (POST)', () => {
    return request(app.getHttpServer())
      .post('/ai/content/generate-text')
      .set('Authorization', 'Bearer test-token')
      .send({
        prompt: 'Hello, world!',
        temperature: 0.7,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.data).toHaveProperty('text')
      })
  })
})
```

### 6.3 Environment Configuration

```bash
# .env.development
GEMINI_API_KEY=your-dev-api-key
GEMINI_BASE_URL=https://generativeai.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-flash
NODE_ENV=development

# .env.production
GEMINI_API_KEY=your-prod-api-key
GEMINI_BASE_URL=https://generativeai.googleapis.com/v1beta
GEMINI_MODEL=gemini-1.5-pro
NODE_ENV=production
```

### 6.4 Best Practices

#### 1. **Error Handling**

```typescript
// Always wrap Gemini operations with try-catch and logging
try {
  const result = await this.geminiTextService.generateText(input)
  this.logger.log(`Text generated: ${result.length} characters`)
  return result
} catch (error) {
  this.logger.error(`Failed to generate text: ${error.message}`, error.stack)

  // Handle specific Gemini errors
  if (error.response?.status === 429) {
    throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
  }

  throw new BadRequestException('Failed to generate content')
}
```

#### 2. **Input Validation**

```typescript
import { IsString, IsOptional, Min, Max } from 'class-validator'

export class GenerateTextDto {
  @IsString()
  @Length(1, 10000)
  prompt: string

  @IsOptional()
  @Min(0)
  @Max(2)
  temperature?: number

  @IsOptional()
  @Min(1)
  @Max(4096)
  maxOutputTokens?: number
}
```

#### 3. **Caching**

```typescript
// Cache expensive AI operations
import { CacheInterceptor } from '@nestjs/cache-manager'

@Controller('ai/content')
@UseInterceptors(CacheInterceptor)
export class ContentController {
  @Get('models')
  @CacheTTL(300) // Cache for 5 minutes
  async getModels() {
    return await this.nestGeminiService.listModels()
  }
}
```

#### 4. **Security**

```typescript
// Sanitize inputs to prevent prompt injection
function sanitizePrompt(prompt: string): string {
  // Remove potentially harmful instructions
  return prompt
    .replace(/(?:ignore|forget|disregard).{0,20}(?:previous|above|instructions)/gi, '')
    .replace(/(?:act|behave|pretend).{0,20}(?:as|like)/gi, '')
    .trim()
    .substring(0, 10000); // Limit length
}

// Use in service
async generateText(request: GeminiTextRequest): Promise<string> {
  const sanitizedPrompt = sanitizePrompt(request.prompt);

  return this.geminiTextService.generateText({
    ...request,
    prompt: sanitizedPrompt,
  });
}
```

#### 5. **Monitoring**

```typescript
// Track metrics with Prometheus
import { PrometheusModule } from '@willsoto/nestjs-prometheus'

@Injectable()
export class GeminiMetricsService {
  private requestCounter: Counter<string>
  private responseTimeHistogram: Histogram<string>

  constructor() {
    this.requestCounter = new Counter({
      name: 'gemini_requests_total',
      help: 'Total number of Gemini API requests',
      labelNames: ['method', 'status'],
    })

    this.responseTimeHistogram = new Histogram({
      name: 'gemini_request_duration_seconds',
      help: 'Duration of Gemini API requests in seconds',
      labelNames: ['method'],
    })
  }

  recordRequest(method: string, status: 'success' | 'error') {
    this.requestCounter.inc({ method, status })
  }

  recordDuration(method: string, duration: number) {
    this.responseTimeHistogram.observe({ method }, duration)
  }
}
```

## 7. Production Deployment

### 7.1 Performance Optimization

```typescript
// Configure HTTP client for production
import { HttpModule } from '@nestjs/axios'

@Module({
  imports: [
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
      retryDelay: 1000,
      retryCondition: (error) => {
        return error.response?.status >= 500 || error.code === 'ECONNABORTED'
      },
    }),
  ],
})
export class ProductionModule {}
```

### 7.2 Health Checks

```typescript
// health/gemini.health.ts
import { Injectable } from '@nestjs/common'
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus'
import { NestGeminiService } from '@nnpp/nest-gemini'

@Injectable()
export class GeminiHealthIndicator extends HealthIndicator {
  constructor(private readonly geminiService: NestGeminiService) {
    super()
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.geminiService.listModels()

      return this.getStatus(key, true, {
        message: 'Gemini API is responding',
      })
    } catch (error) {
      throw new HealthCheckError(
        'Gemini API check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      )
    }
  }
}
```

## 8. Troubleshooting

### Common Issues

#### 1. **API Key Issues**

```typescript
// Validate API key format
function validateGeminiApiKey(apiKey: string): boolean {
  return /^AIza[0-9A-Za-z-_]{35}$/.test(apiKey)
}

// Use in configuration
if (!validateGeminiApiKey(process.env.GEMINI_API_KEY)) {
  throw new Error('Invalid Gemini API key format')
}
```

#### 2. **Rate Limiting**

```typescript
// Implement retry logic with exponential backoff
import { retry } from 'rxjs'

async function callGeminiWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxRetries = 3
  const baseDelay = 1000

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (error.response?.status === 429 && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
}
```

#### 3. **Content Safety**

```typescript
// Handle safety filter blocks
function handleGeminiResponse(response: GeminiResponse): string {
  const candidate = response.candidates?.[0]

  if (!candidate) {
    throw new Error('No response generated')
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Content was blocked by safety filters')
  }

  return candidate.content?.parts?.[0]?.text || ''
}
```

## 9. Resources

- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Documentation](https://ai.google.dev/api/rest)
- [Google AI JavaScript SDK](https://github.com/google/generative-ai-js)
- [NestJS Documentation](https://docs.nestjs.com)

## Tóm Tắt

Hướng dẫn này cung cấp một implementation hoàn chỉnh cho việc tích hợp Google Gemini AI vào NestJS project với Dynamic Module Pattern:

### Các bước chính:

1. **Setup Google AI Studio**: Tạo account và lấy API key
2. **Tạo OpenAPI Spec**: Định nghĩa các endpoints và types
3. **Dynamic Module**: Implement forRoot/forRootAsync pattern
4. **Services**: Text, Chat, Multimodal, Function calling services
5. **Controllers**: RESTful APIs cho các AI operations
6. **Best Practices**: Error handling, rate limiting, security

### Tính năng chính:

- ✅ Text generation với streaming support
- ✅ Multi-turn conversations với history
- ✅ Multimodal processing (text + images)
- ✅ Function calling capabilities
- ✅ Rate limiting và error handling
- ✅ Type-safe với OpenAPI generated client
- ✅ Production-ready với monitoring và health checks

Module này có thể tái sử dụng across multiple services và dễ dàng configure cho các môi trường khác nhau!axios';
import { FactoryProvider } from '@nestjs/common';
import { AxiosInstance } from 'axios';
import { Configuration } from '../client/generated';

export function injectGeminiApiProvider<T>(
ApiClass: new ({
configuration,
basePath,
axios,
}: {
configuration?: Configuration;
basePath?: string;
axios?: AxiosInstance;
}) => T
): FactoryProvider<T> {
return {
provide: ApiClass,
inject: [HttpService],
useFactory: (httpService: HttpService) => {
const config = new Configuration({
basePath: process.env.GEMINI_BASE_URL || 'https://generativeai.googleapis.com/v1beta',
apiKey: process.env.GEMINI_API_KEY,
});

      // Add request interceptor for API key in query params
      httpService.axiosRef.interceptors.request.use((config) => {
        if (process.env.GEMINI_API_KEY) {
          config.params = {
            ...config.params,
            key: process.env.GEMINI_API_KEY,
          };
        }
        return config;
      });

      // Add response interceptor for error handling & rate limiting
      httpService.axiosRef.interceptors.response.use(
        (response) => response,
        (error) => {
          if (error.response) {
            // Rate limit handling
            if (error.response.status === 429) {
              console.warn('Gemini API rate limit exceeded. Please wait before making another request.');
            }
            // Quota exceeded
            if (error.response.status === 403) {
              console.warn('Gemini API quota exceeded or invalid API key.');
            }
          }
          return Promise.reject(error);
        }
      );

      return new ApiClass(config, config.basePath, httpService.axiosRef);
    },

};
}

````

### 4.4 Main Module Implementation

```typescript
// libs/nest-gemini/src/nest-gemini.module.ts
import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import {
  GenerationApi,
  ModelsApi,
  TokensApi,
  EmbeddingsApi
} from './client/generated';
import {
  GeminiModuleOptions,
  GeminiModuleAsyncOptions,
  NEST_GEMINI_CONFIG,
  NEST_GEMINI_CLIENT
} from './types';
import { injectGeminiApiProvider } from './utils/providers';
import { NestGeminiService } from './nest-gemini.service';
import { GeminiTextService } from './services/gemini-text.service';
import { GeminiChatService } from './services/gemini-chat.service';
import { GeminiMultimodalService } from './services/gemini-multimodal.service';
import { GeminiFunctionService } from './services/gemini-function.service';

@Global()
@Module({})
export class NestGeminiModule {
  static forRoot(options: GeminiModuleOptions): DynamicModule {
    const geminiConfigProvider: Provider = {
      provide: NEST_GEMINI_CONFIG,
      useValue: options,
    };

    return {
      module: NestGeminiModule,
      imports: [HttpModule, ConfigModule],
      providers: [
        geminiConfigProvider,
        injectGeminiApiProvider(GenerationApi),
        injectGeminiApiProvider(ModelsApi),
        injectGeminiApiProvider(TokensApi),
        injectGeminiApiProvider(EmbeddingsApi),
        NestGeminiService,
        GeminiTextService,
        GeminiChatService,
        GeminiMultimodalService,
        GeminiFunctionService,
      ],
      exports: [
        NestGeminiService,
        GeminiTextService,
        GeminiChatService,
        GeminiMultimodalService,
        GeminiFunctionService,
        GenerationApi,
        ModelsApi,
      ],
    };
  }

  static forRootAsync(options: GeminiModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: NestGeminiModule,
      imports: [HttpModule, ConfigModule, ...(options.imports || [])],
      providers: [
        ...asyncProviders,
        injectGeminiApiProvider(GenerationApi),
        injectGeminiApiProvider(ModelsApi),
        injectGeminiApiProvider(TokensApi),
        injectGeminiApiProvider(EmbeddingsApi),
        NestGeminiService,
        GeminiTextService,
        GeminiChatService,
        GeminiMultimodalService,
        GeminiFunctionService,
      ],
      exports: [
        NestGeminiService,
        GeminiTextService,
        GeminiChatService,
        GeminiMultimodalService,
        GeminiFunctionService,
        GenerationApi,
        ModelsApi,
      ],
    };
  }

  private static createAsyncProviders(options: GeminiModuleAsyncOptions): Provider[] {
    return [
      {
        provide: NEST_GEMINI_CONFIG,
        useFactory: options.useFactory,
        inject: options.inject || [],
      },
    ];
  }
}
````

### 4.5 Core Service Implementation

```typescript
// libs/nest-gemini/src/nest-gemini.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common'
import { GenerationApi, ModelsApi, TokensApi, EmbeddingsApi } from './client/generated'
import { NEST_GEMINI_CONFIG, GeminiModuleOptions, GeminiResponse } from './types'

@Injectable()
export class NestGeminiService {
  private readonly logger = new Logger(NestGeminiService.name)

  constructor(
    @Inject(NEST_GEMINI_CONFIG) private readonly config: GeminiModuleOptions,
    private readonly generationApi: GenerationApi,
    private readonly modelsApi: ModelsApi,
    private readonly tokensApi: TokensApi,
    private readonly embeddingsApi: EmbeddingsApi,
  ) {
    this.logger.log('Gemini Service initialized successfully')
  }

  getConfig(): GeminiModuleOptions {
    return this.config
  }

  // List available models
  async listModels() {
    try {
      const response = await this.modelsApi.listModels()
      this.logger.log(`Retrieved ${response.data.models?.length || 0} models`)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to list models: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get specific model details
  async getModel(modelId: string) {
    try {
      const response = await this.modelsApi.getModel(modelId)
      return response.data
    } catch (error) {
      this.logger.error(`Failed to get model ${modelId}: ${error.message}`, error.stack)
      throw error
    }
  }

  // Count tokens for input content
  async countTokens(modelId: string, contents: any[]) {
    try {
      const response = await this.tokensApi.countTokens(modelId, {
        contents,
      })
      return response.data
    } catch (error) {
      this.logger.error(`Failed to count tokens: ${error.message}`, error.stack)
      throw error
    }
  }

  // Generate embeddings
  async embedContent(modelId: string, content: any, taskType?: string) {
    try {
      const response = await this.embeddingsApi.embedContent(modelId, {
        content,
        taskType,
      })
      return response.data
    } catch (error) {
      this.logger.error(`Failed to generate embeddings: ${error.message}`, error.stack)
      throw error
    }
  }

  // Helper method to get default model
  getDefaultModel(): string {
    return this.config.defaultModel || 'gemini-1.5-flash'
  }
}
```

### 4.6 Text Generation Service

```typescript
// libs/nest-gemini/src/services/gemini-text.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GenerationApi } from '../client/generated'
import { GeminiTextRequest, GeminiResponse } from '../types'
import { NestGeminiService } from '../nest-gemini.service'

@Injectable()
export class GeminiTextService {
  private readonly logger = new Logger(GeminiTextService.name)

  constructor(
    private readonly generationApi: GenerationApi,
    private readonly nestGeminiService: NestGeminiService,
  ) {}

  // Generate text content
  async generateText(request: GeminiTextRequest, modelId?: string): Promise<string> {
    try {
      const model = modelId || this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: [
          {
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: request.options?.temperature,
          topP: request.options?.topP,
          topK: request.options?.topK,
          maxOutputTokens: request.options?.maxOutputTokens,
          stopSequences: request.options?.stopSequences,
        },
        safetySettings: request.options?.safetySettings,
      }

      const response = await this.generationApi.generateContent(model, generateRequest)

      const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      this.logger.log(`Generated text response: ${text.length} characters`)
      return text
    } catch (error) {
      this.logger.error(`Failed to generate text: ${error.message}`, error.stack)
      throw error
    }
  }

  // Generate text with streaming
  async generateTextStream(request: GeminiTextRequest, modelId?: string): Promise<AsyncIterable<string>> {
    try {
      const model = modelId || this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: [
          {
            parts: [{ text: request.prompt }],
          },
        ],
        generationConfig: {
          temperature: request.options?.temperature,
          topP: request.options?.topP,
          topK: request.options?.topK,
          maxOutputTokens: request.options?.maxOutputTokens,
        },
        safetySettings: request.options?.safetySettings,
      }

      const response = await this.generationApi.streamGenerateContent(model, generateRequest)

      // Convert response to async iterable
      return this.createTextStreamIterator(response.data)
    } catch (error) {
      this.logger.error(`Failed to generate text stream: ${error.message}`, error.stack)
      throw error
    }
  }

  // Generate summary
  async summarizeText(
    text: string,
    options?: { maxLength?: number; style?: 'bullet_points' | 'paragraph' },
  ): Promise<string> {
    const style = options?.style || 'paragraph'
    const maxLength = options?.maxLength || 200

    const prompt = `Please summarize the following text in ${style === 'bullet_points' ? 'bullet points' : 'a paragraph'} format, keeping it under ${maxLength} words:

${text}`

    return this.generateText({ prompt })
  }

  // Generate content with specific format
  async generateStructuredContent(prompt: string, format: 'json' | 'markdown' | 'html'): Promise<string> {
    const structuredPrompt = `${prompt}

Please format your response as valid ${format.toUpperCase()}.`

    return this.generateText({
      prompt: structuredPrompt,
      options: {
        temperature: 0.1, // Lower temperature for structured output
      },
    })
  }

  private async *createTextStreamIterator(response: any): AsyncIterable<string> {
    // Implementation for streaming response
    // This would depend on how the generated client handles streaming
    if (Array.isArray(response)) {
      for (const chunk of response) {
        if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
          yield chunk.candidates[0].content.parts[0].text
        }
      }
    }
  }
}
```

### 4.7 Chat Service Implementation

```typescript
// libs/nest-gemini/src/services/gemini-chat.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GenerationApi } from '../client/generated'
import { GeminiChatRequest, ChatHistory } from '../types'
import { NestGeminiService } from '../nest-gemini.service'

@Injectable()
export class GeminiChatService {
  private readonly logger = new Logger(GeminiChatService.name)

  // Store chat sessions
  private chatSessions = new Map<string, ChatHistory[]>()

  constructor(
    private readonly generationApi: GenerationApi,
    private readonly nestGeminiService: NestGeminiService,
  ) {}

  // Start new chat session
  async startChat(sessionId: string, systemInstruction?: string): Promise<void> {
    const history: ChatHistory[] = []

    if (systemInstruction) {
      history.push({
        role: 'user',
        parts: [{ text: systemInstruction }],
      })
    }

    this.chatSessions.set(sessionId, history)
    this.logger.log(`Started new chat session: ${sessionId}`)
  }

  // Send message in chat session
  async sendMessage(sessionId: string, message: string, options?: GeminiChatRequest['options']): Promise<string> {
    try {
      const history = this.chatSessions.get(sessionId) || []

      // Add user message to history
      history.push({
        role: 'user',
        parts: [{ text: message }],
      })

      const model = this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: history.map((h) => ({
          role: h.role,
          parts: h.parts,
        })),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          topP: options?.topP,
          topK: options?.topK,
          maxOutputTokens: options?.maxOutputTokens,
        },
        safetySettings: options?.safetySettings,
      }

      const response = await this.generationApi.generateContent(model, generateRequest)
      const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      // Add assistant response to history
      history.push({
        role: 'model',
        parts: [{ text: reply }],
      })

      this.chatSessions.set(sessionId, history)
      this.logger.log(`Chat message processed for session: ${sessionId}`)

      return reply
    } catch (error) {
      this.logger.error(`Failed to send chat message: ${error.message}`, error.stack)
      throw error
    }
  }

  // Get chat history
  getChatHistory(sessionId: string): ChatHistory[] {
    return this.chatSessions.get(sessionId) || []
  }

  // Clear chat session
  clearChat(sessionId: string): void {
    this.chatSessions.delete(sessionId)
    this.logger.log(`Cleared chat session: ${sessionId}`)
  }

  // Get all active sessions
  getActiveSessions(): string[] {
    return Array.from(this.chatSessions.keys())
  }
}
```

### 4.8 Multimodal Service Implementation

```typescript
// libs/nest-gemini/src/services/gemini-multimodal.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GenerationApi } from '../client/generated'
import { GeminiMultimodalRequest } from '../types'
import { NestGeminiService } from '../nest-gemini.service'
import * as fs from 'fs'
import * as path from 'path'

@Injectable()
export class GeminiMultimodalService {
  private readonly logger = new Logger(GeminiMultimodalService.name)

  constructor(
    private readonly generationApi: GenerationApi,
    private readonly nestGeminiService: NestGeminiService,
  ) {}

  // Analyze image with text prompt
  async analyzeImage(imagePath: string, prompt: string, options?: GeminiMultimodalRequest['options']): Promise<string> {
    try {
      const imageData = await this.loadImageAsBase64(imagePath)

      return this.analyzeImageFromBase64(imageData.data, imageData.mimeType, prompt, options)
    } catch (error) {
      this.logger.error(`Failed to analyze image: ${error.message}`, error.stack)
      throw error
    }
  }

  // Analyze image from base64 data
  async analyzeImageFromBase64(
    base64Data: string,
    mimeType: string,
    prompt: string,
    options?: GeminiMultimodalRequest['options'],
  ): Promise<string> {
    try {
      const model = this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: options?.temperature || 0.4,
          topP: options?.topP,
          topK: options?.topK,
          maxOutputTokens: options?.maxOutputTokens,
        },
        safetySettings: options?.safetySettings,
      }

      const response = await this.generationApi.generateContent(model, generateRequest)
      const result = response.data.candidates?.[0]?.content?.parts?.[0]?.text || ''

      this.logger.log(`Image analysis completed: ${result.length} characters`)
      return result
    } catch (error) {
      this.logger.error(`Failed to analyze image from base64: ${error.message}`, error.stack)
      throw error
    }
  }

  // Generate image description
  async describeImage(imagePath: string): Promise<string> {
    return this.analyzeImage(imagePath, 'Describe this image in detail.')
  }

  // Extract text from image (OCR)
  async extractTextFromImage(imagePath: string): Promise<string> {
    return this.analyzeImage(imagePath, 'Extract all text from this image. Return only the text content.')
  }

  // Analyze multiple images
  async analyzeMultipleImages(images: Array<{ path: string; description?: string }>, prompt: string): Promise<string> {
    try {
      const parts = [{ text: prompt }]

      for (const image of images) {
        const imageData = await this.loadImageAsBase64(image.path)

        if (image.description) {
          parts.push({ text: image.description })
        }

        parts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.data,
          },
        })
      }

      const model = this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 2048,
        },
      }

      const response = await this.generationApi.generateContent(model, generateRequest)
      return response.data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } catch (error) {
      this.logger.error(`Failed to analyze multiple images: ${error.message}`, error.stack)
      throw error
    }
  }

  // Utility methods
  private async loadImageAsBase64(imagePath: string): Promise<{ data: string; mimeType: string }> {
    const buffer = fs.readFileSync(imagePath)
    const base64Data = buffer.toString('base64')
    const mimeType = this.getMimeTypeFromPath(imagePath)

    return { data: base64Data, mimeType }
  }

  private getMimeTypeFromPath(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }

    return mimeTypes[ext] || 'image/jpeg'
  }

  // Video analysis (for future implementation)
  async analyzeVideo(videoPath: string, prompt: string): Promise<string> {
    // Implementation would depend on Gemini's video analysis capabilities
    throw new Error('Video analysis not yet implemented')
  }
}
```

### 4.9 Function Calling Service

```typescript
// libs/nest-gemini/src/services/gemini-function.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GenerationApi } from '../client/generated'
import { GeminiFunctionRequest, FunctionDeclaration } from '../types'
import { NestGeminiService } from '../nest-gemini.service'

@Injectable()
export class GeminiFunctionService {
  private readonly logger = new Logger(GeminiFunctionService.name)

  // Registry of available functions
  private functionRegistry = new Map<string, Function>()

  constructor(
    private readonly generationApi: GenerationApi,
    private readonly nestGeminiService: NestGeminiService,
  ) {}

  // Register a function that can be called by Gemini
  registerFunction(name: string, func: Function, declaration: FunctionDeclaration): void {
    this.functionRegistry.set(name, func)
    this.logger.log(`Registered function: ${name}`)
  }

  // Generate content with function calling
  async generateWithFunctions(request: GeminiFunctionRequest): Promise<{ text: string; functionCalls?: any[] }> {
    try {
      const model = this.nestGeminiService.getDefaultModel()

      const generateRequest = {
        contents: [
          {
            parts: [{ text: request.prompt }],
          },
        ],
        tools: [
          {
            functionDeclarations: request.functions,
          },
        ],
        toolConfig: {
          functionCallingConfig: {
            mode: request.options?.functionCallingMode || 'AUTO',
            allowedFunctionNames: request.options?.allowedFunctionNames,
          },
        },
        generationConfig: {
          temperature: request.options?.temperature,
          topP: request.options?.topP,
          topK: request.options?.topK,
          maxOutputTokens: request.options?.maxOutputTokens,
        },
      }

      const response = await this.generationApi.generateContent(model, generateRequest)

      const candidate = response.data.candidates?.[0]
      if (!candidate) {
        throw new Error('No response candidate found')
      }

      const parts = candidate.content?.parts || []
      let text = ''
      const functionCalls: any[] = []

      for (const part of parts) {
        if (part.text) {
          text += part.text
        } else if (part.functionCall) {
          functionCalls.push(part.functionCall)
        }
      }

      // Execute function calls if any
      if (functionCalls.length > 0) {
        const functionResults = await this.executeFunctionCalls(functionCalls)

        // Send function results back to model for final response
        const followUpRequest = {
          contents: [
            {
              parts: [{ text: request.prompt }],
            },
            {
              parts: [
                ...functionCalls.map((call) => ({ functionCall: call })),
                ...functionResults.map((result) => ({ functionResponse: result })),
              ],
            },
          ],
          tools: [{ functionDeclarations: request.functions }],
        }

        const finalResponse = await this.generationApi.generateContent(model, followUpRequest)
        text = finalResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || text
      }

      return { text, functionCalls }
    } catch (error) {
      this.logger.error(`Failed to generate with functions: ${error.message}`, error.stack)
      throw error
    }
  }

  // Execute function calls
  private async executeFunctionCalls(functionCalls: any[]): Promise<any[]> {
    const results: any[] = []

    for (const call of functionCalls) {
      const { name, args } = call
      const func = this.functionRegistry.get(name)

      if (!func) {
        this.logger.warn(`Function not found: ${name}`)
        results.push({
          name,
          response: { error: `Function ${name} not found` },
        })
        continue
      }

      try {
        const result = await func(args)
        results.push({
          name,
          response: result,
        })
        this.logger.log(`Executed function: ${name}`)
      } catch (error) {
        this.logger.error(`Function execution failed: ${name}`, error)
        results.push({
          name,
          response: { error: error.message },
        })
      }
    }

    return results
  }

  // Helper method to create common function declarations
  createWeatherFunction(): FunctionDeclaration {
    return {
      name: 'get_weather',
      description: 'Get current weather information for a location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get weather for',
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'Temperature unit',
          },
        },
        required: ['location'],
      },
    }
  }

  createCalculatorFunction(): FunctionDeclaration {
    return {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: 'Mathematical expression to evaluate',
          },
        },
        required: ['expression'],
      },
    }
  }
}
```

### 4.10 Export Index File

```typescript
// libs/nest-gemini/src/index.ts
export * from './nest-gemini.module'
export * from './nest-gemini.service'
export * from './services/gemini-text.service'
export * from './services/gemini-chat.service'
export * from './services/gemini-multimodal.service'
export * from './services/gemini-function.service'
export * from './types'
export * from './utils/providers'

// Re-export generated client types
export * from './client/generated'
```

## 5. Các Use Cases Thực Tế

### 5.1 Integration vào App Module

```typescript
// apps/your-service/src/app.module.ts
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NestGeminiModule } from '@nnpp/nest-gemini'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Async configuration với ConfigService
    NestGeminiModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        apiKey: configService.get<string>('GEMINI_API_KEY'),
        baseUrl: configService.get<string>('GEMINI_BASE_URL'),
        defaultModel: configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash',
        options: {
          timeout: 30000,
          retryConfig: {
            retries: 3,
            retryDelay: 1000,
          },
          rateLimiting: {
            enabled: true,
            maxRequests: 15,
            windowMs: 60000, // 1 minute
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

### 5.2 Content Generation Controller

```typescript
// apps/your-service/src/controllers/content.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { GeminiTextService, GeminiChatService, GeminiMultimodalService, GeminiFunctionService } from '@nnpp/nest-gemini'
import { AuthGuard } from '@nestjs/passport'

@Controller('ai/content')
@UseGuards(AuthGuard('jwt'))
export class ContentController {
  constructor(
    private readonly geminiTextService: GeminiTextService,
    private readonly geminiChatService: GeminiChatService,
    private readonly geminiMultimodalService: GeminiMultimodalService,
    private readonly geminiFunctionService: GeminiFunctionService,
  ) {}

  // Generate text content
  @Post('generate-text')
  async generateText(@Body() body: { prompt: string; temperature?: number; maxTokens?: number }) {
    const result = await this.geminiTextService.generateText({
      prompt: body.prompt,
      options: {
        temperature: body.temperature || 0.7,
        maxOutputTokens: body.maxTokens || 1024,
      },
    })

    return {
      success: true,
      data: { text: result },
    }
  }

  // Generate structured content (JSON, Markdown, HTML)
  @Post('generate-structured')
  async generateStructured(@Body() body: { prompt: string; format: 'json' | 'markdown' | 'html' }) {
    const result = await this.geminiTextService.generateStructuredContent(body.prompt, body.format)

    return {
      success: true,
      data: { content: result, format: body.format },
    }
  }

  // Summarize text
  @Post('summarize')
  async summarizeText(@Body() body: { text: string; maxLength?: number; style?: 'bullet_points' | 'paragraph' }) {
    const summary = await this.geminiTextService.summarizeText(body.text, {
      maxLength: body.maxLength,
      style: body.style,
    })

    return {
      success: true,
      data: { summary },
    }
  }

  // Analyze image
  @Post('analyze-image')
  @UseInterceptors(FileInterceptor('image'))
  async analyzeImage(@UploadedFile() file: Express.Multer.File, @Body() body: { prompt: string }) {
    const base64Data = file.buffer.toString('base64')

    const analysis = await this.geminiMultimodalService.analyzeImageFromBase64(base64Data, file.mimetype, body.prompt)

    return {
      success: true,
      data: { analysis },
    }
  }

  // Extract text from image (OCR)
  @Post('ocr')
  @UseInterceptors(FileInterceptor('image'))
  async extractTextFromImage(@UploadedFile() file: Express.Multer.File) {
    const base64Data = file.buffer.toString('base64')

    const extractedText = await this.geminiMultimodalService.analyzeImageFromBase64(
      base64Data,
      file.mimetype,
      'Extract all text from this image. Return only the text content.',
    )

    return {
      success: true,
      data: { extractedText },
    }
  }
}
```

### 5.3 Chat Controller

```typescript
// apps/your-service/src/controllers/chat.controller.ts
import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { GeminiChatService } from '@nnpp/nest-gemini'
import { AuthGuard } from '@nestjs/passport'
import { CurrentUser } from '../decorators/current-user.decorator'

@Controller('ai/chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly geminiChatService: GeminiChatService) {}

  // Start new chat session
  @Post('sessions')
  async startChatSession(@CurrentUser() user: any, @Body() body: { systemInstruction?: string }) {
    const sessionId = `${user.id}-${Date.now()}`

    await this.geminiChatService.startChat(sessionId, body.systemInstruction)

    return {
      success: true,
      data: { sessionId },
    }
  }

  // Send message to chat session
  @Post('sessions/:sessionId/messages')
  async sendMessage(@Param('sessionId') sessionId: string, @Body() body: { message: string; temperature?: number }) {
    const reply = await this.geminiChatService.sendMessage(sessionId, body.message, { temperature: body.temperature })

    return {
      success: true,
      data: { reply },
    }
  }

  // Get chat history
  @Get('sessions/:sessionId/history')
  async getChatHistory(@Param('sessionId') sessionId: string) {
    const history = this.geminiChatService.getChatHistory(sessionId)

    return {
      success: true,
      data: { history },
    }
  }

  // Clear chat session
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearChatSession(@Param('sessionId') sessionId: string) {
    this.geminiChatService.clearChat(sessionId)
  }

  // Get active sessions for user
  @Get('sessions')
  async getActiveSessions(@CurrentUser() user: any) {
    const sessions = this.geminiChatService.getActiveSessions().filter((sessionId) => sessionId.startsWith(user.id))

    return {
      success: true,
      data: { sessions },
    }
  }
}
```

### 5.4 Function Calling Controller

```typescript
// apps/your-service/src/controllers/functions.controller.ts
import { Controller, Post, Body, OnModuleInit } from '@nestjs/common'
import { GeminiFunctionService } from '@nnpp/nest-gemini'
import { WeatherService } from '../services/weather.service'
import { CalculatorService } from '../services/calculator.service'

@Controller('ai/functions')
export class FunctionsController implements OnModuleInit {
  constructor(
    private readonly geminiFunctionService: GeminiFunctionService,
    private readonly weatherService: WeatherService,
    private readonly calculatorService: CalculatorService,
  ) {}

  onModuleInit() {
    // Register weather function
    this.geminiFunctionService.registerFunction(
      'get_weather',
      this.weatherService.getCurrentWeather.bind(this.weatherService),
      this.geminiFunctionService.createWeatherFunction(),
    )

    // Register calculator function
    this.geminiFunctionService.registerFunction(
      'calculate',
      this.calculatorService.evaluate.bind(this.calculatorService),
      this.geminiFunctionService.createCalculatorFunction(),
    )
  }

  // Generate content with function calling
  @Post('generate-with-functions')
  async generateWithFunctions(
    @Body()
    body: {
      prompt: string
      functions: string[] // Function names to make available
    },
  ) {
    const availableFunctions = []

    if (body.functions.includes('get_weather')) {
      availableFunctions.push(this.geminiFunctionService.createWeatherFunction())
    }

    if (body.functions.includes('calculate')) {
      availableFunctions.push(this.geminiFunctionService.createCalculatorFunction())
    }

    const result = await this.geminiFunctionService.generateWithFunctions({
      prompt: body.prompt,
      functions: availableFunctions,
      options: {
        functionCallingMode: 'AUTO',
      },
    })

    return {
      success: true,
      data: result,
    }
  }
}
```

### 5.5 Supporting Services

```typescript
// apps/your-service/src/services/weather.service.ts
import { Injectable } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'

@Injectable()
export class WeatherService {
  constructor(private readonly httpService: HttpService) {}

  async getCurrentWeather(args: { location: string; unit?: string }) {
    try {
      // Mock weather API call - replace with real weather service
      const { location, unit = 'celsius' } = args

      // Simulate API call
      const weatherData = {
        location,
        temperature: unit === 'celsius' ? 25 : 77,
        condition: 'sunny',
        humidity: 65,
        unit,
      }

      return weatherData
    } catch (error) {
      return { error: `Failed to get weather for ${args.location}` }
    }
  }
}

// apps/your-service/src/services/calculator.service.ts
import { Injectable } from '@nestjs/common'

@Injectable()
export class CalculatorService {
  evaluate(args: { expression: string }) {
    try {
      // Simple math evaluation - use a proper math parser in production
      const { expression } = args

      // Basic safety check
      if (!/^[0-9+\-*/(). ]+$/.test(expression)) {
        throw new Error('Invalid expression')
      }

      const result = Function('"use strict"; return (' + expression + ')')()

      return {
        expression,
        result: Number(result),
        success: true,
      }
    } catch (error) {
      return {
        expression: args.expression,
        error: error.message,
        success: false,
      }
    }
  }
}
```

### 5.6 AI Assistant Service (Advanced Use Case)

```typescript
// apps/your-service/src/services/ai-assistant.service.ts
import { Injectable, Logger } from '@nestjs/common'
import { GeminiTextService, GeminiChatService, GeminiMultimodalService, GeminiFunctionService } from '@nnpp/nest-gemini'

@Injectable()
export class AIAssistantService {
  private readonly logger = new Logger(AIAssistantService.name)

  constructor(
    private readonly geminiTextService: GeminiTextService,
    private readonly geminiChatService: GeminiChatService,
    private readonly geminiMultimodalService: GeminiMultimodalService,
    private readonly geminiFunctionService: GeminiFunctionService,
  ) {}

  // Content generation for different purposes
  async generateMarketingCopy(product: any, tone: 'professional' | 'casual' | 'exciting') {
    const prompt = `Create marketing copy for the following product with a ${tone} tone:
    
Product Name: ${product.name}
Description: ${product.description}
Key Features: ${product.features.join(', ')}
Target Audience: ${product.targetAudience}

Generate:
1. A compelling headline
2. A 2-paragraph product description
3. 5 key selling points
4. A call-to-action

Format the response as JSON.`

    return await this.geminiTextService.generateStructuredContent(prompt, 'json')
  }

  // Code review and suggestions
  async reviewCode(code: string, language: string) {
    const prompt = `Review the following ${language} code and provide:
1. Overall code quality assessment (1-10)
2. Potential bugs or issues
3. Performance improvements
4. Best practice suggestions
5. Security considerations

Code:
\`\`\`${language}
${code}
\`\`\``

    return await this.geminiTextService.generateText({
      prompt,
      options: { temperature: 0.1 }, // Low temperature for technical accuracy
    })
  }

  // Smart document processing
  async processDocument(content: string, task: 'summarize' | 'extract_key_points' | 'translate' | 'analyze_sentiment') {
    let prompt: string

    switch (task) {
      case 'summarize':
        prompt = `Summarize the following document in 3-5 bullet points:\n\n${content}`
        break
      case 'extract_key_points':
        prompt = `Extract the main key points from this document and format them as a numbered list:\n\n${content}`
        break
      case 'translate':
        prompt = `Translate the following text to Vietnamese:\n\n${content}`
        break
      case 'analyze_sentiment':
        prompt = `Analyze the sentiment of this document and provide:
1. Overall sentiment (positive/negative/neutral)
2. Confidence score (0-100%)
3. Key emotional indicators
4. Brief explanation

Document:\n\n${content}`
        break
      default:
        throw new Error('Invalid task type')
    }

    return await this.geminiTextService.generateText({ prompt })
  }

  // Smart data analysis
  async analyzeBusinessData(data: any[], analysis_type: 'trends' | 'insights' | 'recommendations') {
    const dataString = JSON.stringify(data, null, 2)

    const prompt = `Analyze the following business data and provide ${analysis_type}:

Data:
${dataString}

Please provide:
1. Key observations
2. Important ${analysis_type}
3. Actionable recommendations
4. Potential concerns or opportunities

Format the response clearly and provide specific examples from the data.`

    return await this.geminiTextService.generateText({
      prompt,
      options: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    })
  }

  // Multi-modal content analysis
  async analyzeContentWithImages(text: string, images: Buffer[], imageTypes: string[]) {
    try {
      // Convert images to base64
      const imageData = images.map((buffer, index) => ({
        data: buffer.toString('base64'),
        mimeType: imageTypes[index],
      }))

      // For now, analyze text and first image separately
      const textAnalysis = await this.geminiTextService.generateText({
        prompt: `Analyze this text content: ${text}`,
      })

      let imageAnalysis = ''
      if (imageData.length > 0) {
        imageAnalysis = await this.geminiMultimodalService.analyzeImageFromBase64(
          imageData[0].data,
          imageData[0].mimeType,
          'Describe this image and how it relates to the text content',
        )
      }

      return {
        textAnalysis,
        imageAnalysis,
        combinedInsights: await this.geminiTextService.generateText({
          prompt: `Based on the text analysis: "${textAnalysis}" and image analysis: "${imageAnalysis}", provide combined insights about this content.`,
        }),
      }
    } catch (error) {
      this.logger.error('Failed to analyze multi-modal content:', error)
      throw error
    }
  }

  // Advanced chat with context and memory
  async smartChatWithContext(
    sessionId: string,
    message: string,
    context?: {
      userProfile?: any
      previousActions?: string[]
      currentProject?: any
    },
  ) {
    // Build context-aware prompt
    let systemInstruction = 'You are a helpful AI assistant.'

    if (context) {
      systemInstruction += ' Here is some context about the user and current session:'

      if (context.userProfile) {
        systemInstruction += `\nUser Profile: ${JSON.stringify(context.userProfile)}`
      }

      if (context.previousActions?.length) {
        systemInstruction += `\nRecent Actions: ${context.previousActions.join(', ')}`
      }

      if (context.currentProject) {
        systemInstruction += `\nCurrent Project: ${JSON.stringify(context.currentProject)}`
      }
    }

    // Start session if not exists
    if (!this.geminiChatService.getChatHistory(sessionId).length) {
      await this.geminiChatService.startChat(sessionId, systemInstruction)
    }

    return await this.geminiChatService.sendMessage(sessionId, message, {
      temperature: 0.7,
    })
  }
}
```

---

## ✅ Checklist hoàn thiện

- ✅ **Setup Google AI Studio**: Tạo account và lấy API key
- ✅ **OpenAPI Specification**: Định nghĩa đầy đủ các endpoints và schemas
- ✅ **Dynamic Module Pattern**: Implementation forRoot/forRootAsync
- ✅ **Core Services**: Text, Chat, Multimodal, Function calling
- ✅ **Advanced Features**: Streaming, webhooks, rate limiting
- ✅ **Production Ready**: Error handling, monitoring, health checks
- ✅ **Testing**: Unit tests, integration tests, e2e tests
- ✅ **Best Practices**: Security, performance, maintainability

---

## 🎯 Tổng Kết

Hướng dẫn này cung cấp một implementation hoàn chỉnh cho việc tích hợp Google Gemini AI vào NestJS project:

### Các tính năng chính:

1. **Text Generation**: Generate content với các options linh hoạt
2. **Multi-turn Chat**: Conversation management với history
3. **Multimodal AI**: Xử lý text + image đồng thời
4. **Function Calling**: AI có thể gọi external functions
5. **Streaming**: Real-time content generation
6. **Rate Limiting**: Protect API quota
7. **Error Handling**: Comprehensive error management
8. **Type Safety**: Full TypeScript support với generated client
9. **Testing**: Complete test coverage
10. **Production Ready**: Monitoring, health checks, deployment

### Use Cases phổ biến:

- **Content Creation**: Marketing copy, blog posts, social media
- **Code Analysis**: Code review, bug detection, optimization
- **Document Processing**: Summarization, translation, sentiment analysis
- **Customer Support**: Intelligent chatbots, automated responses
- **Data Analysis**: Business insights, trend analysis, reporting
- **Image Analysis**: OCR, content description, classification
- **Multi-modal Applications**: Combined text and image processing

Module này có thể tái sử dụng across multiple services và dễ dàng configure cho các môi trường khác nhau! 🚀
