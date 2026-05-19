import { serve } from "@hono/node-server"
import { createApp } from "./app.js"
import { createRemoteRunnerClient } from "./remote-runner.js"

const portText = process.env["PORT"] ?? "8787"
const port = Number.parseInt(portText, 10)
const runnerUrl = process.env["CURSOR_RUNNER_URL"]
const runner =
  runnerUrl === undefined
    ? undefined
    : createRemoteRunnerClient({
        url: runnerUrl,
        token: process.env["CURSOR_RUNNER_TOKEN"],
      })

serve({
  fetch: createApp(runner === undefined ? {} : { runner }).fetch,
  port,
})

console.log(`cursor-proxy node server listening on http://127.0.0.1:${port}`)
