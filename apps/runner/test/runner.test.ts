import { describe, expect, it } from "vitest"
import { type CursorSpawner, createCursorRunner, cursorOutputToEvents } from "../src/cursor-cli"

function streamFromText(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
}

describe("cursor runner", () => {
  it("#given cursor stream-json #when converted #then runner events preserve text", () => {
    // given
    const output = [
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi"}]}}',
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi there"}]}}',
      '{"type":"result","usage":{"inputTokens":1,"outputTokens":2}}',
    ].join("\n")

    // when
    const events = cursorOutputToEvents(output)

    // then
    expect(events[0]).toEqual({ type: "text", text: "Hi" })
    expect(events[1]).toEqual({ type: "text", text: " there" })
    expect(events[2]?.type).toBe("usage")
  })

  it("#given runner request #when executed #then cursor agent command and stdin prompt are used", async () => {
    // given
    const calls: { command: readonly string[]; prompt: string }[] = []
    const spawner: CursorSpawner = {
      spawn(input) {
        calls.push({ command: input.command, prompt: input.prompt })
        return {
          stdout: streamFromText(
            '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Done"}]}}\n',
          ),
          stderr: streamFromText(""),
          exited: Promise.resolve(0),
        }
      },
    }
    const runner = createCursorRunner({
      cursorBinary: "cursor",
      workspace: "/tmp/project",
      spawner,
      env: {},
    })

    // when
    const result = await runner.run({
      model: "cursor-acp/auto",
      prompt: "USER: Hello",
    })

    // then
    expect(result[0]).toEqual({ type: "text", text: "Done" })
    expect(calls[0]?.command).toEqual([
      "cursor",
      "agent",
      "--print",
      "--trust",
      "--output-format",
      "stream-json",
      "--stream-partial-output",
      "--workspace",
      "/tmp/project",
      "--model",
      "cursor-acp/auto",
    ])
    expect(calls[0]?.prompt).toBe("USER: Hello")
  })
})
