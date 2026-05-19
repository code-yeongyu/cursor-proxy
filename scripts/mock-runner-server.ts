import { serve } from "bun"

const portText = process.env["PORT"] ?? "8799"
const port = Number.parseInt(portText, 10)

serve({
  port,
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "mock-runner" })
    }
    if (url.pathname !== "/run") {
      return Response.json({ error: "not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({ stream: false }))
    const stream =
      typeof body === "object" && body !== null && "stream" in body && body.stream === true
    const events = [{ type: "text", text: "mock cursor says hi" }, { type: "done" }] as const

    if (!stream) {
      return Response.json(events)
    }

    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const event of events) {
            controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`))
          }
          controller.close()
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson" } },
    )
  },
})

console.log(`mock runner listening on http://127.0.0.1:${port}`)
