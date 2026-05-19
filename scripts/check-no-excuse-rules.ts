import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOTS: readonly string[] = ["apps", "packages", "scripts"]
const tsSuppressIgnore = ["no", "ts", "ignore"].join("-")
const tsSuppressExpect = ["no", "ts", "expect", "error"].join("-")
const nonNullRule = ["no", "non", "null", "assertion"].join("-")
const bang = String.fromCharCode(33)
type Rule = {
  readonly name: string
  readonly pattern: RegExp
}

const FORBIDDEN: readonly Rule[] = [
  { name: "no-any-annotation", pattern: /:\s*any\b|Promise\s*<\s*any\b|Array\s*<\s*any\b/u },
  { name: tsSuppressIgnore, pattern: new RegExp(`@ts-${"ignore"}`, "u") },
  { name: tsSuppressExpect, pattern: new RegExp(`@ts-${"expect-error"}`, "u") },
  { name: "no-enum", pattern: /(^|[^\w])enum\s+[A-Za-z]/u },
  { name: nonNullRule, pattern: new RegExp(`[A-Za-z0-9_\\])]${bang}`, "u") },
  { name: "no-throw-literal", pattern: /throw\s+["'0-9]/u },
]

async function collectFiles(root: string): Promise<readonly string[]> {
  const proc = Bun.spawn(["rg", "--files", root, "-g", "*.ts", "-g", "!dist", "-g", "!dist-node"], {
    stdout: "pipe",
    stderr: "pipe",
  })
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
  if (exitCode !== 0 && stdout.trim().length === 0) {
    return []
  }
  return stdout.split("\n").filter((line) => line.length > 0)
}

const files = (await Promise.all(ROOTS.map(collectFiles))).flat()
const violations: string[] = []

for (const file of files) {
  const text = readFileSync(join(process.cwd(), file), "utf8")
  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(text)) {
      violations.push(`${file}: ${rule.name}`)
    }
  }
}

if (violations.length > 0) {
  console.error(violations.join("\n"))
  process.exit(1)
}

console.log(`No no-excuse violations in ${files.length} TypeScript files.`)
