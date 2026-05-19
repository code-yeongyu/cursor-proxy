import { z } from "zod"
import type { OpenAiUsage } from "./openai.js"
import type { RunnerEvent } from "./runner.js"

const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
})

const ThinkingPartSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
})

const AssistantEventSchema = z.object({
  type: z.literal("assistant"),
  timestamp_ms: z.number().optional(),
  message: z.object({
    role: z.literal("assistant"),
    content: z.array(z.union([TextPartSchema, ThinkingPartSchema])),
  }),
})

const ThinkingEventSchema = z.object({
  type: z.literal("thinking"),
  text: z.string().optional(),
  timestamp_ms: z.number().optional(),
})

const ResultEventSchema = z.object({
  type: z.literal("result"),
  usage: z.record(z.string(), z.unknown()).optional(),
})

const StreamJsonEventSchema = z.union([
  AssistantEventSchema,
  ThinkingEventSchema,
  ResultEventSchema,
])
type StreamJsonEvent = z.infer<typeof StreamJsonEventSchema>

function readCount(record: Record<string, unknown>, keys: readonly string[]): number {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value)
    }
  }
  return 0
}

function readCost(record: Record<string, unknown>): number | undefined {
  const value = record["cost"] ?? record["totalCost"] ?? record["total_cost"]
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function normalizeUsage(record: Record<string, unknown>): OpenAiUsage | undefined {
  const inputTokens = readCount(record, ["inputTokens", "input_tokens", "prompt_tokens"])
  const outputTokens = readCount(record, ["outputTokens", "output_tokens", "completion_tokens"])
  const reasoningTokens = readCount(record, ["reasoningTokens", "reasoning_tokens"])
  const cacheReadTokens = readCount(record, ["cacheReadTokens", "cache_read_tokens"])
  const cacheWriteTokens = readCount(record, ["cacheWriteTokens", "cache_write_tokens"])
  const cost = readCost(record)
  const promptTokens = inputTokens + cacheReadTokens + cacheWriteTokens
  const totalTokens = promptTokens + outputTokens + reasoningTokens

  if (totalTokens === 0 && cost === undefined) {
    return undefined
  }

  const usage = {
    prompt_tokens: promptTokens,
    completion_tokens: outputTokens,
    total_tokens: totalTokens,
    prompt_tokens_details: {
      cached_tokens: cacheReadTokens,
      cache_write_tokens: cacheWriteTokens,
    },
    completion_tokens_details: {
      reasoning_tokens: reasoningTokens,
    },
  } satisfies Omit<OpenAiUsage, "cost">

  return cost === undefined ? usage : { ...usage, cost }
}

function parseLine(line: string): StreamJsonEvent | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  const parsed = StreamJsonEventSchema.safeParse(JSON.parse(trimmed))
  return parsed.success ? parsed.data : undefined
}

function longestPrefixDelta(previous: string, current: string): string {
  if (previous.length === 0) {
    return current
  }
  if (current.startsWith(previous)) {
    return current.slice(previous.length)
  }
  if (previous.startsWith(current)) {
    return ""
  }

  let index = 0
  const max = Math.min(previous.length, current.length)
  while (index < max && previous[index] === current[index]) {
    index += 1
  }
  return current.slice(index)
}

export function convertCursorStreamJsonLine(input: {
  readonly line: string
  readonly previousText: string
  readonly previousReasoning: string
  readonly sawTextPartials: boolean
  readonly sawReasoningPartials: boolean
}): {
  readonly event: RunnerEvent | undefined
  readonly text: string
  readonly reasoning: string
  readonly sawTextPartials: boolean
  readonly sawReasoningPartials: boolean
} {
  const event = parseLine(input.line)
  if (event === undefined) {
    return {
      event: undefined,
      text: input.previousText,
      reasoning: input.previousReasoning,
      sawTextPartials: input.sawTextPartials,
      sawReasoningPartials: input.sawReasoningPartials,
    }
  }

  if (event.type === "thinking") {
    const text = event.text ?? ""
    return {
      event: text.length > 0 ? { type: "reasoning", text } : undefined,
      text: input.previousText,
      reasoning: input.previousReasoning,
      sawTextPartials: input.sawTextPartials,
      sawReasoningPartials: text.length > 0 || input.sawReasoningPartials,
    }
  }

  if (event.type === "assistant") {
    const text = event.message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("")
    const reasoning = event.message.content
      .filter((part) => part.type === "thinking")
      .map((part) => part.thinking)
      .join("")
    const isPartial = typeof event.timestamp_ms === "number"

    if (text.length > 0) {
      const delta = longestPrefixDelta(input.previousText, text)
      if (isPartial) {
        return {
          event: delta.length > 0 ? { type: "text", text: delta } : undefined,
          text,
          reasoning: input.previousReasoning,
          sawTextPartials: true,
          sawReasoningPartials: input.sawReasoningPartials,
        }
      }
      if (input.sawTextPartials) {
        return {
          event: undefined,
          text,
          reasoning: input.previousReasoning,
          sawTextPartials: input.sawTextPartials,
          sawReasoningPartials: input.sawReasoningPartials,
        }
      }
      return {
        event: delta.length > 0 ? { type: "text", text: delta } : undefined,
        text,
        reasoning: input.previousReasoning,
        sawTextPartials: input.sawTextPartials,
        sawReasoningPartials: input.sawReasoningPartials,
      }
    }

    if (reasoning.length > 0) {
      const delta = longestPrefixDelta(input.previousReasoning, reasoning)
      if (isPartial) {
        return {
          event: delta.length > 0 ? { type: "reasoning", text: delta } : undefined,
          text: input.previousText,
          reasoning,
          sawTextPartials: input.sawTextPartials,
          sawReasoningPartials: true,
        }
      }
      if (input.sawReasoningPartials) {
        return {
          event: undefined,
          text: input.previousText,
          reasoning,
          sawTextPartials: input.sawTextPartials,
          sawReasoningPartials: input.sawReasoningPartials,
        }
      }
      return {
        event: delta.length > 0 ? { type: "reasoning", text: delta } : undefined,
        text: input.previousText,
        reasoning,
        sawTextPartials: input.sawTextPartials,
        sawReasoningPartials: input.sawReasoningPartials,
      }
    }
  }

  if (event.type === "result") {
    const usage = event.usage === undefined ? undefined : normalizeUsage(event.usage)
    return {
      event: usage === undefined ? { type: "done" } : { type: "usage", usage },
      text: input.previousText,
      reasoning: input.previousReasoning,
      sawTextPartials: input.sawTextPartials,
      sawReasoningPartials: input.sawReasoningPartials,
    }
  }

  return {
    event: undefined,
    text: input.previousText,
    reasoning: input.previousReasoning,
    sawTextPartials: input.sawTextPartials,
    sawReasoningPartials: input.sawReasoningPartials,
  }
}
