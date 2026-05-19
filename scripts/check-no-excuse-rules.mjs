import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const roots = ["apps", "packages", "scripts"]
const skippedDirectories = new Set(["node_modules", "dist", "dist-node", "coverage"])
const tsSuppressIgnore = ["no", "ts", "ignore"].join("-")
const tsSuppressExpect = ["no", "ts", "expect", "error"].join("-")
const nonNullRule = ["no", "non", "null", "assertion"].join("-")
const bang = String.fromCharCode(33)

const forbidden = [
  { name: "no-any-annotation", pattern: /:\s*any\b|Promise\s*<\s*any\b|Array\s*<\s*any\b/u },
  { name: tsSuppressIgnore, pattern: new RegExp(`@ts-${"ignore"}`, "u") },
  { name: tsSuppressExpect, pattern: new RegExp(`@ts-${"expect-error"}`, "u") },
  { name: "no-enum", pattern: /(^|[^\w])enum\s+[A-Za-z]/u },
  { name: nonNullRule, pattern: new RegExp(`[A-Za-z0-9_\\])]${bang}`, "u") },
  { name: "no-throw-literal", pattern: /throw\s+["'0-9]/u },
]

function collectFiles(root) {
  const files = []
  const entries = readdirSync(root)

  for (const entry of entries) {
    const path = join(root, entry)
    const stats = statSync(path)
    if (stats.isDirectory()) {
      if (!skippedDirectories.has(entry)) {
        files.push(...collectFiles(path))
      }
      continue
    }
    if (entry.endsWith(".ts")) {
      files.push(path)
    }
  }

  return files
}

const files = roots.flatMap((root) => collectFiles(root))
const violations = []

for (const file of files) {
  const text = readFileSync(join(process.cwd(), file), "utf8")
  for (const rule of forbidden) {
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
