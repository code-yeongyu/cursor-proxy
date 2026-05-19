import {
  type ChatCompletionChunk,
  createReasoningChunk,
  createStopChunk,
  createTextChunk,
  createUsageChunk,
} from "./openai.js"
import type { RunnerEvent } from "./runner.js"

export function formatSseData(payload: ChatCompletionChunk): string {
  return `data: ${JSON.stringify(payload)}\n\n`
}

export function formatSseDone(): string {
  return "data: [DONE]\n\n"
}

export function runnerEventToSse(input: {
  readonly event: RunnerEvent
  readonly id: string
  readonly created: number
  readonly model: string
}): string {
  if (input.event.type === "text") {
    return formatSseData(
      createTextChunk({
        id: input.id,
        created: input.created,
        model: input.model,
        content: input.event.text,
      }),
    )
  }

  if (input.event.type === "reasoning") {
    return formatSseData(
      createReasoningChunk({
        id: input.id,
        created: input.created,
        model: input.model,
        reasoning: input.event.text,
      }),
    )
  }

  if (input.event.type === "usage") {
    return formatSseData(
      createUsageChunk({
        id: input.id,
        created: input.created,
        model: input.model,
        usage: input.event.usage,
      }),
    )
  }

  return formatSseData(
    createStopChunk({
      id: input.id,
      created: input.created,
      model: input.model,
    }),
  )
}
