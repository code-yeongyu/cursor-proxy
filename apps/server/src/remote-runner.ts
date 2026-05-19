import {
  type RunnerClient,
  type RunnerEvent,
  RunnerEventSchema,
  type RunnerRequest,
} from "@cursor-proxy/shared"

export type RemoteRunnerConfig = {
  readonly url: string
  readonly token?: string | undefined
}

function authHeaders(token: string | undefined): Headers {
  const headers = new Headers({ "Content-Type": "application/json" })
  if (token !== undefined && token.length > 0) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  return headers
}

function parseEventLine(line: string): RunnerEvent | undefined {
  const trimmed = line.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  const parsed = RunnerEventSchema.safeParse(JSON.parse(trimmed))
  return parsed.success ? parsed.data : undefined
}

export function createRemoteRunnerClient(config: RemoteRunnerConfig): RunnerClient {
  const base = config.url.replace(/\/+$/, "")
  return {
    async complete(request: RunnerRequest) {
      const response = await fetch(`${base}/run`, {
        method: "POST",
        headers: authHeaders(config.token),
        body: JSON.stringify({ ...request, stream: false }),
      })
      if (!response.ok) {
        throw new Error(`Runner returned ${response.status}`)
      }
      const parsed = RunnerEventSchema.array().safeParse(await response.json())
      if (!parsed.success) {
        throw new Error("Runner returned malformed completion response")
      }
      const text = parsed.data
        .filter((event) => event.type === "text")
        .map((event) => event.text)
        .join("")
      const usage = parsed.data.find((event) => event.type === "usage")?.usage
      return usage === undefined ? { content: text } : { content: text, usage }
    },
    async stream(request: RunnerRequest) {
      const response = await fetch(`${base}/run`, {
        method: "POST",
        headers: authHeaders(config.token),
        body: JSON.stringify({ ...request, stream: true }),
      })
      if (!response.ok || response.body === null) {
        throw new Error(`Runner stream failed with ${response.status}`)
      }

      const decoder = new TextDecoder()
      const reader = response.body.getReader()
      return new ReadableStream<RunnerEvent>({
        async start(controller) {
          let buffer = ""
          for (;;) {
            const read = await reader.read()
            if (read.done) {
              break
            }
            buffer += decoder.decode(read.value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""
            for (const line of lines) {
              const event = parseEventLine(line)
              if (event !== undefined) {
                controller.enqueue(event)
              }
            }
          }
          if (buffer.length > 0) {
            const event = parseEventLine(buffer)
            if (event !== undefined) {
              controller.enqueue(event)
            }
          }
          controller.close()
        },
      })
    },
  }
}
