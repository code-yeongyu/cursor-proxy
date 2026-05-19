import {
  convertCursorStreamJsonLine,
  type RunnerEvent,
  type RunnerRequest,
  RunnerRequestSchema,
} from "@cursor-proxy/shared"

export type SpawnResult = {
  readonly stdout: ReadableStream<Uint8Array>
  readonly stderr: ReadableStream<Uint8Array>
  readonly exited: Promise<number>
}

export type CursorSpawner = {
  readonly spawn: (input: {
    readonly command: readonly string[]
    readonly prompt: string
    readonly env: Record<string, string | undefined>
  }) => SpawnResult
}

export type CursorRunnerOptions = {
  readonly cursorBinary: string
  readonly workspace?: string | undefined
  readonly spawner: CursorSpawner
  readonly env: Record<string, string | undefined>
}

function commandFor(request: RunnerRequest, options: CursorRunnerOptions): readonly string[] {
  const workspace = request.workspace ?? options.workspace
  const base = [
    options.cursorBinary,
    "agent",
    "--print",
    "--trust",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
  ]

  const withWorkspace =
    workspace === undefined || workspace.length === 0 ? base : [...base, "--workspace", workspace]

  return [...withWorkspace, "--model", request.model]
}

async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text()
}

export function createCursorRunner(options: CursorRunnerOptions) {
  return {
    async run(requestInput: unknown): Promise<readonly RunnerEvent[]> {
      const request = RunnerRequestSchema.parse(requestInput)
      const process = options.spawner.spawn({
        command: commandFor(request, options),
        prompt: request.prompt,
        env: options.env,
      })
      const [stdout, stderr, exitCode] = await Promise.all([
        readStreamText(process.stdout),
        readStreamText(process.stderr),
        process.exited,
      ])
      if (exitCode !== 0) {
        return [
          { type: "text", text: stderr.length > 0 ? stderr : `cursor exited with ${exitCode}` },
        ]
      }

      return cursorOutputToEvents(stdout)
    },
    stream(requestInput: unknown): ReadableStream<RunnerEvent> {
      const request = RunnerRequestSchema.parse(requestInput)
      const process = options.spawner.spawn({
        command: commandFor(request, options),
        prompt: request.prompt,
        env: options.env,
      })
      return cursorStreamToRunnerEvents(process.stdout)
    },
  }
}

export function cursorOutputToEvents(output: string): readonly RunnerEvent[] {
  let previousText = ""
  let previousReasoning = ""
  let sawTextPartials = false
  let sawReasoningPartials = false
  const events: RunnerEvent[] = []

  for (const line of output.split("\n")) {
    const converted = convertCursorStreamJsonLine({
      line,
      previousText,
      previousReasoning,
      sawTextPartials,
      sawReasoningPartials,
    })
    previousText = converted.text
    previousReasoning = converted.reasoning
    sawTextPartials = converted.sawTextPartials
    sawReasoningPartials = converted.sawReasoningPartials
    if (converted.event !== undefined) {
      events.push(converted.event)
    }
  }

  if (!events.some((event) => event.type === "done")) {
    events.push({ type: "done" })
  }
  return events
}

export function cursorStreamToRunnerEvents(
  stream: ReadableStream<Uint8Array>,
): ReadableStream<RunnerEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  return new ReadableStream<RunnerEvent>({
    async start(controller) {
      let buffer = ""
      let previousText = ""
      let previousReasoning = ""
      let sawTextPartials = false
      let sawReasoningPartials = false

      for (;;) {
        const read = await reader.read()
        if (read.done) {
          break
        }
        buffer += decoder.decode(read.value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const converted = convertCursorStreamJsonLine({
            line,
            previousText,
            previousReasoning,
            sawTextPartials,
            sawReasoningPartials,
          })
          previousText = converted.text
          previousReasoning = converted.reasoning
          sawTextPartials = converted.sawTextPartials
          sawReasoningPartials = converted.sawReasoningPartials
          if (converted.event !== undefined) {
            controller.enqueue(converted.event)
          }
        }
      }

      if (buffer.length > 0) {
        const converted = convertCursorStreamJsonLine({
          line: buffer,
          previousText,
          previousReasoning,
          sawTextPartials,
          sawReasoningPartials,
        })
        if (converted.event !== undefined) {
          controller.enqueue(converted.event)
        }
      }
      controller.enqueue({ type: "done" })
      controller.close()
    },
  })
}

export function createBunSpawner(): CursorSpawner {
  return {
    spawn(input) {
      const proc = Bun.spawn({
        cmd: [...input.command],
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
        env: input.env,
      })
      proc.stdin.write(input.prompt)
      proc.stdin.end()
      return {
        stdout: proc.stdout,
        stderr: proc.stderr,
        exited: proc.exited,
      }
    },
  }
}
