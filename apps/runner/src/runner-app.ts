import { RunnerRequestSchema } from "@cursor-proxy/shared"
import { Hono } from "hono"
import { type CursorRunnerOptions, createBunSpawner, createCursorRunner } from "./cursor-cli.js"

export type RunnerBindings = {
  readonly CURSOR_RUNNER_TOKEN?: string
  readonly CURSOR_BINARY?: string
  readonly CURSOR_WORKSPACE?: string
}

export type RunnerAppOptions = {
  readonly runnerOptions?: Partial<CursorRunnerOptions>
  readonly token?: string | undefined
}

function authorized(request: Request, token: string | undefined): boolean {
  if (token === undefined || token.length === 0) {
    return true
  }
  return request.headers.get("Authorization") === `Bearer ${token}`
}

function encodeEvent(event: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`)
}

export function createRunnerApp(options: RunnerAppOptions = {}) {
  const app = new Hono<{ Bindings: RunnerBindings }>()

  app.get("/health", (context) => context.json({ ok: true, service: "cursor-proxy-runner" }))
  app.post("/run", async (context) => {
    const token = options.token ?? context.env.CURSOR_RUNNER_TOKEN
    if (!authorized(context.req.raw, token)) {
      return context.json({ error: "Unauthorized" }, 401)
    }

    const body = await context.req.json().catch(() => undefined)
    const parsed = RunnerRequestSchema.safeParse(body)
    if (!parsed.success) {
      return context.json({ error: "Malformed runner request" }, 400)
    }

    const runnerOptions = {
      cursorBinary: options.runnerOptions?.cursorBinary ?? context.env.CURSOR_BINARY ?? "cursor",
      cursorAgentDirect: options.runnerOptions?.cursorAgentDirect ?? false,
      spawner: options.runnerOptions?.spawner ?? createBunSpawner(),
      env: options.runnerOptions?.env ?? Bun.env,
    }
    const workspace = options.runnerOptions?.workspace ?? context.env.CURSOR_WORKSPACE
    const runner = createCursorRunner(
      workspace === undefined ? runnerOptions : { ...runnerOptions, workspace },
    )

    if (parsed.data.stream === true) {
      const source = runner.stream(parsed.data)
      const reader = source.getReader()
      return new Response(
        new ReadableStream<Uint8Array>({
          async start(controller) {
            for (;;) {
              const read = await reader.read()
              if (read.done) {
                break
              }
              controller.enqueue(encodeEvent(read.value))
            }
            controller.close()
          },
        }),
        { headers: { "Content-Type": "application/x-ndjson" } },
      )
    }

    return context.json(await runner.run(parsed.data))
  })

  return app
}
