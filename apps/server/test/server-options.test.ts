import { describe, expect, it } from "vitest"
import { CURSOR_STREAM_IDLE_TIMEOUT_SECONDS } from "../src/server-options"

describe("server options", () => {
  it("#given delayed cursor runner stream #when served by Bun #then idle timeout allows delayed chunks", () => {
    const bunDefaultIdleTimeoutSeconds = 10

    expect(CURSOR_STREAM_IDLE_TIMEOUT_SECONDS).toBeGreaterThan(bunDefaultIdleTimeoutSeconds)
  })
})
