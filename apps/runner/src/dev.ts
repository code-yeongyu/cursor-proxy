import { serve } from "bun"
import { createBunSpawner } from "./cursor-cli.js"
import { createRunnerApp } from "./runner-app.js"

const portText = process.env["PORT"] ?? "8791"
const port = Number.parseInt(portText, 10)
const app = createRunnerApp({
  runnerOptions: {
    cursorBinary: process.env["CURSOR_BINARY"] ?? "cursor",
    workspace: process.env["CURSOR_WORKSPACE"],
    spawner: createBunSpawner(),
    env: Bun.env,
  },
})

serve({
  port,
  fetch: app.fetch,
})

console.log(`cursor-proxy runner listening on http://127.0.0.1:${port}`)
