import { z } from "zod"
import type { OpenAiUsage } from "./openai.js"
import { OpenAiUsageSchema } from "./usage-schema.js"

export const RunnerEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("reasoning"),
    text: z.string(),
  }),
  z.object({
    type: z.literal("usage"),
    usage: OpenAiUsageSchema,
  }),
  z.object({
    type: z.literal("done"),
  }),
])
export type RunnerEvent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "reasoning"; readonly text: string }
  | { readonly type: "usage"; readonly usage: OpenAiUsage }
  | { readonly type: "done" }

export const RunnerRequestSchema = z.object({
  model: z.string().min(1),
  prompt: z.string(),
  workspace: z.string().optional(),
  stream: z.boolean().optional(),
})
export type RunnerRequest = z.infer<typeof RunnerRequestSchema>

export type RunnerClient = {
  readonly complete: (request: RunnerRequest) => Promise<{
    readonly content: string
    readonly usage?: OpenAiUsage | undefined
  }>
  readonly stream: (request: RunnerRequest) => Promise<ReadableStream<RunnerEvent>>
}
