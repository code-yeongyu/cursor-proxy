import { z } from "zod"

export const ChatRoleSchema = z.enum(["system", "user", "assistant", "tool"])
export type ChatRole = z.infer<typeof ChatRoleSchema>

export const TextContentPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})
export type TextContentPart = z.infer<typeof TextContentPartSchema>

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.union([z.string(), z.array(TextContentPartSchema), z.null()]).optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      }),
    )
    .optional(),
})
export type ChatMessage = z.infer<typeof ChatMessageSchema>

export const ChatCompletionRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(ChatMessageSchema).min(1),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
  max_tokens: z.number().int().positive().optional(),
  tools: z.array(z.unknown()).optional(),
  stream_options: z
    .object({
      include_usage: z.boolean().optional(),
    })
    .optional(),
})
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>

export type OpenAiUsage = {
  readonly prompt_tokens: number
  readonly completion_tokens: number
  readonly total_tokens: number
  readonly prompt_tokens_details: {
    readonly cached_tokens: number
    readonly cache_write_tokens: number
  }
  readonly completion_tokens_details: {
    readonly reasoning_tokens: number
  }
  readonly cost?: number | undefined
}

export type ChatCompletionResponse = {
  readonly id: string
  readonly object: "chat.completion"
  readonly created: number
  readonly model: string
  readonly choices: readonly [
    {
      readonly index: 0
      readonly message: {
        readonly role: "assistant"
        readonly content: string
      }
      readonly finish_reason: "stop"
    },
  ]
  readonly usage?: OpenAiUsage | undefined
}

export type ChatCompletionChunk = {
  readonly id: string
  readonly object: "chat.completion.chunk"
  readonly created: number
  readonly model: string
  readonly choices: readonly {
    readonly index: number
    readonly delta: {
      readonly content?: string
      readonly reasoning_content?: string
    }
    readonly finish_reason: "stop" | null
  }[]
  readonly usage?: OpenAiUsage | undefined
}

export function createChatCompletionResponse(input: {
  readonly id: string
  readonly created: number
  readonly model: string
  readonly content: string
  readonly usage?: OpenAiUsage | undefined
}): ChatCompletionResponse {
  const base = {
    id: input.id,
    object: "chat.completion",
    created: input.created,
    model: input.model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: input.content,
        },
        finish_reason: "stop",
      },
    ],
  } satisfies Omit<ChatCompletionResponse, "usage">

  return input.usage === undefined ? base : { ...base, usage: input.usage }
}

export function createTextChunk(input: {
  readonly id: string
  readonly created: number
  readonly model: string
  readonly content: string
}): ChatCompletionChunk {
  return {
    id: input.id,
    object: "chat.completion.chunk",
    created: input.created,
    model: input.model,
    choices: [
      {
        index: 0,
        delta: { content: input.content },
        finish_reason: null,
      },
    ],
  }
}

export function createReasoningChunk(input: {
  readonly id: string
  readonly created: number
  readonly model: string
  readonly reasoning: string
}): ChatCompletionChunk {
  return {
    id: input.id,
    object: "chat.completion.chunk",
    created: input.created,
    model: input.model,
    choices: [
      {
        index: 0,
        delta: { reasoning_content: input.reasoning },
        finish_reason: null,
      },
    ],
  }
}

export function createStopChunk(input: {
  readonly id: string
  readonly created: number
  readonly model: string
}): ChatCompletionChunk {
  return {
    id: input.id,
    object: "chat.completion.chunk",
    created: input.created,
    model: input.model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: "stop",
      },
    ],
  }
}

export function createUsageChunk(input: {
  readonly id: string
  readonly created: number
  readonly model: string
  readonly usage: OpenAiUsage
}): ChatCompletionChunk {
  return {
    id: input.id,
    object: "chat.completion.chunk",
    created: input.created,
    model: input.model,
    choices: [],
    usage: input.usage,
  }
}

export function createOpenAiError(message: string, status: number) {
  return {
    error: {
      message,
      type: "invalid_request_error",
      code: status,
    },
  }
}
