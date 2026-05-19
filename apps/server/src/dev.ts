import { serve } from "bun"
import { createApp } from "./app.js"
import { createRemoteRunnerClient } from "./remote-runner.js"
import { CURSOR_STREAM_IDLE_TIMEOUT_SECONDS } from "./server-options.js"

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
const app = createApp(runner === undefined ? {} : { runner })

serve({
  port,
  fetch: app.fetch,
  idleTimeout: CURSOR_STREAM_IDLE_TIMEOUT_SECONDS,
})

console.log(`cursor-proxy server listening on http://127.0.0.1:${port}`)
