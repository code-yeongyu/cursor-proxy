import { describe, expect, it } from "vitest"
import { createLogger } from "../src/logger"

describe("server logger", () => {
  it("#given info log level #when message is written #then console info receives the line", () => {
    // given
    const originalInfo = console.info
    const originalLog = console.log
    const infoLines: string[] = []
    const logLines: string[] = []
    console.info = (...values: unknown[]) => {
      infoLines.push(values.map(String).join(" "))
    }
    console.log = (...values: unknown[]) => {
      logLines.push(values.map(String).join(" "))
    }

    try {
      const logger = createLogger("server-test", () => "info")

      // when
      logger.info("ready")

      // then
      expect(infoLines).toEqual([expect.stringContaining('"level":"info"')])
      expect(logLines).toEqual([])
    } finally {
      console.info = originalInfo
      console.log = originalLog
    }
  })
})
