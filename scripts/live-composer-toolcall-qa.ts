import { mkdtempSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const MODEL = "composer-2.5"

async function read(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text()
}

const workspace = mkdtempSync(join(tmpdir(), "cursor-proxy-live-"))
const target = join(workspace, "tool-proof.txt")
writeFileSync(target, "cursor-proxy-live-tool-proof\n", "utf8")

const prompt = [
  "You are doing a live QA for cursor-proxy.",
  "Use your available tools to inspect the file named tool-proof.txt in the current workspace.",
  "Then answer with exactly two lines:",
  "TOOL_USED: yes",
  "FILE_TEXT: <the exact file contents without extra commentary>",
  "Do not edit files.",
].join("\n")

const proc = Bun.spawn({
  cmd: [
    "cursor",
    "agent",
    "--print",
    "--trust",
    "--output-format",
    "stream-json",
    "--stream-partial-output",
    "--workspace",
    workspace,
    "--model",
    MODEL,
  ],
  stdin: "pipe",
  stdout: "pipe",
  stderr: "pipe",
  env: Bun.env,
})

proc.stdin.write(prompt)
proc.stdin.end()

const [stdout, stderr, exitCode] = await Promise.all([
  read(proc.stdout),
  read(proc.stderr),
  proc.exited,
])

const proof = readFileSync(target, "utf8").trim()
const hasToolSignal = /tool|read|grep|cat|shell|command/i.test(stdout)
const hasExpectedText = stdout.includes(proof)
const report = {
  model: MODEL,
  workspace,
  exitCode,
  hasToolSignal,
  hasExpectedText,
  stdoutTail: stdout.slice(-4000),
  stderrTail: stderr.slice(-2000),
}

console.log(JSON.stringify(report, null, 2))

if (exitCode !== 0 || !hasExpectedText || !hasToolSignal) {
  process.exit(1)
}
