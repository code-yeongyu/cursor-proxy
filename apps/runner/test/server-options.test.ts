import { describe, expect, it } from "vitest"
import { CURSOR_STREAM_IDLE_TIMEOUT_SECONDS } from "../src/server-options"

describe("runner server options", () => {
  it("#given long-running cursor stream #when served by Bun #then idle timeout allows delayed first chunks", () => {
    // given
    const cursorCanSpendMoreThanTenSecondsBeforeFirstChunk = 10

    // when
    const timeout = CURSOR_STREAM_IDLE_TIMEOUT_SECONDS

    // then
    expect(timeout).toBeGreaterThan(cursorCanSpendMoreThanTenSecondsBeforeFirstChunk)
  })
})
