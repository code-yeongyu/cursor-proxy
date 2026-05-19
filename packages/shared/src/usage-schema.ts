import { z } from "zod"

export const OpenAiUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  prompt_tokens_details: z.object({
    cached_tokens: z.number().int().nonnegative(),
    cache_write_tokens: z.number().int().nonnegative(),
  }),
  completion_tokens_details: z.object({
    reasoning_tokens: z.number().int().nonnegative(),
  }),
  cost: z.number().nonnegative().optional(),
})
