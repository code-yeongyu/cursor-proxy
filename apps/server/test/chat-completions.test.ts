import { describe, expect, it } from "bun:test"
import type { RunnerClient, RunnerEvent } from "@cursor-proxy/shared"
import { createApp } from "../src/app"

function createMockRunner(events: readonly RunnerEvent[]): RunnerClient {
  return {
    async complete() {
      const content = events
        .filter((event) => event.type === "text")
        .map((event) => event.text)
        .join("")
      return { content }
    },
    async stream() {
      return new ReadableStream<RunnerEvent>({
        start(controller) {
          for (const event of events) {
            controller.enqueue(event)
          }
          controller.close()
        },
      })
    },
  }
}

describe("chat completions API", () => {
  it("#given valid non-stream request #when posted #then OpenAI chat completion is returned", async () => {
    // given
    const app = createApp({
      runner: createMockRunner([{ type: "text", text: "Hello from Cursor" }]),
      id: () => "chatcmpl_test",
      now: () => 1_000,
    })

    // when
    const response = await app.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "cursor-acp/auto",
        messages: [{ role: "user", content: "Hello" }],
      }),
      headers: { "Content-Type": "application/json" },
    })

    // then
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.object).toBe("chat.completion")
    expect(body.choices[0].message.content).toBe("Hello from Cursor")
  })

  it("#given valid stream request #when posted #then SSE chunks and done marker are returned", async () => {
    // given
    const app = createApp({
      runner: createMockRunner([
        { type: "text", text: "Hello" },
        { type: "text", text: " world" },
        { type: "done" },
      ]),
      id: () => "chatcmpl_stream",
      now: () => 1_000,
    })

    // when
    const response = await app.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({
        model: "cursor-acp/auto",
        stream: true,
        messages: [{ role: "user", content: "Hello" }],
      }),
      headers: { "Content-Type": "application/json" },
    })

    // then
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/event-stream")
    const text = await response.text()
    expect(text).toContain('"object":"chat.completion.chunk"')
    expect(text).toContain('"content":"Hello"')
    expect(text).toContain("data: [DONE]")
  })

  it("#given malformed request #when posted #then OpenAI error is returned", async () => {
    // given
    const app = createApp({ runner: createMockRunner([]) })

    // when
    const response = await app.request("/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "cursor-acp/auto" }),
      headers: { "Content-Type": "application/json" },
    })

    // then
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error.type).toBe("invalid_request_error")
  })
})
