# Cursor Proxy Ultra Work Plan

## TL;DR
> Summary:      Build `cursor-proxy` from an empty directory into a production TypeScript monorepo with a Hono OpenAI-compatible server, a separate Cursor CLI runner, Cloudflare Workers compatibility, strict quality gates, OpenAPI docs, CI, and manual HTTP QA.
> Deliverables:
> - Private-or-confirmed GitHub repository initialized when `gh` auth allows it, with description, topics, branch rules, and release tag policy
> - Bun + pnpm monorepo with `@cursor-proxy/protocol`, `@cursor-proxy/core`, `@cursor-proxy/runner`, and `@cursor-proxy/server`
> - OpenAI-compatible `/v1/chat/completions` JSON and SSE behavior backed by Cursor `stream-json`
> - Runner mode that spawns `cursor-agent --print --output-format stream-json --stream-partial-output --workspace <dir> --model <model>` outside Workers
> - Cloudflare Workers-compatible server mode that talks to the runner over HTTP
> - OpenAPI `/openapi.json`, Scalar `/docs/scalar`, Swagger `/docs/swagger`, README/docs, CI, tests, and evidence-backed manual QA
> Effort:       Large
> Risk:         High — split-runtime streaming proxy plus undocumented Cursor flags (`--workspace`, `--stream-partial-output`) require deterministic mocks and real CLI verification.

## Scope
### Must have
- Initialize local git and GitHub repository if authenticated `gh` access is available.
- Configure GitHub repository description, topics, branch protection/rulesets, and documented tag/release convention.
- Use a TypeScript monorepo with Bun runtime support and pnpm workspace support.
- Enforce ultra-strict TypeScript via `typescript-programmer`: Hono, Zod, Biome, `tsc --noEmit`, no `any`, no `enum`, no non-null assertions, no `@ts-ignore`, no `@ts-expect-error`, no default exports except runtime-required entrypoints.
- Use TDD for implementation tasks; tests must be written in given/when/then wording, not Arrange/Act/Assert comments.
- Provide Hono OpenAI-compatible server mode that is deployable to Cloudflare Workers and uses only Fetch API-compatible primitives.
- Provide separate Cursor CLI client-runner mode that can run on the same Mac mini or another host and spawn the Cursor CLI.
- Preserve behavioral source from `opencode-cursor`: spawn Cursor in `stream-json`, parse NDJSON, map assistant/thinking/tool/result events to OpenAI chat completion JSON/SSE.
- Support both JSON and SSE responses from `/v1/chat/completions`.
- Include `/health`, `/v1/models`, `/openapi.json`, `/docs/scalar`, and `/docs/swagger`.
- Include informative structured logging with request id, route, model, stream flag, status, duration, and runner status; never log prompts, message content, secrets, Authorization headers, or runner tokens.
- Include CI for install, typecheck, lint, format check, test, OpenAPI generation, no-excuse scan, and Cloudflare Workers deploy dry-run.
- Include docs/README with local runner/server flows, Worker deployment, remote runner topology, OpenAI-compatible examples, and manual QA commands.

### Must NOT have (guardrails, anti-slop, scope boundaries)
- Must not implement product code during this planning step.
- Must not make the Workers server spawn `cursor-agent`; only runner mode may spawn local processes.
- Must not add Express, ESLint, Prettier, Jest, ts-node, tsx, or ad hoc validators.
- Must not introduce DB/storage/migrations; this proxy is stateless except process runtime.
- Must not execute OpenAI tool calls locally in MVP; translate Cursor `tool_call` events into OpenAI `tool_calls` and document that tool execution belongs to the caller/client loop.
- Must not hand-edit generated OpenAPI artifacts after generation.
- Must not log prompt bodies, tool arguments, file contents, token values, or request bodies.
- Must not add broad compatibility layers for old data formats; this is a new empty repo.

## Verification strategy
> Zero human intervention — all verification is agent-executed.
- Test decision: TDD + Bun test, with Worker dry-run through Wrangler and HTTP QA through curl/tmux.
- QA policy: every task has agent-executed scenarios.
- Evidence: `evidence/task-<N>-<slug>.<ext>`
- Red/green policy: implementation tasks must capture the first failing test in `evidence/task-<N>-<slug>-red.txt`, then passing output in `evidence/task-<N>-<slug>-green.txt`.
- Type policy: every code task must pass `pnpm typecheck`, `pnpm lint`, `pnpm no-excuse`, and relevant `bun test` filters before commit.

## Execution strategy
### Parallel execution waves
> Target 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks to maximize parallelism.

Wave 1 (no dependencies):
- Task 1: Git and GitHub bootstrap
- Task 2: Root monorepo tooling
- Task 3: Ultra-strict TypeScript and no-excuse gates
- Task 4: Test harness, fixtures, and mock cursor runner
- Task 5: Architecture guardrails and repo-local docs baseline

Wave 2 (after Wave 1):
- Task 6: OpenAI protocol schemas depends [2, 3]
- Task 7: Runner protocol and config schemas depends [2, 3]
- Task 8: Prompt builder and model normalization depends [6]
- Task 9: Stream-json parser, line buffer, and usage mapper depends [4, 6]
- Task 10: OpenAI JSON/SSE formatter and converter depends [4, 6, 9]

Wave 3 (after Wave 2):
- Task 11: Cursor process adapter depends [4, 7, 9]
- Task 12: Runner HTTP app and CLI mode depends [7, 11]
- Task 13: Server Hono app foundation depends [2, 3, 6]
- Task 14: Server runner HTTP client depends [7, 12, 13]
- Task 15: Non-streaming `/v1/chat/completions` depends [8, 10, 13, 14]

Wave 4 (after Wave 3):
- Task 16: Streaming `/v1/chat/completions` SSE depends [8, 10, 13, 14]
- Task 17: OpenAPI, Scalar, Swagger, and generated docs depends [13, 15, 16]
- Task 18: Cloudflare Workers packaging and runtime modes depends [12, 13, 17]
- Task 19: CI quality gates and deploy dry-run depends [2, 3, 15, 16, 17, 18]
- Task 20: README, manual QA, GitHub rules, and release tag depends [1, 5, 12, 15, 16, 17, 19]

Critical path: Task 2 -> Task 3 -> Task 6 -> Task 9 -> Task 10 -> Task 11 -> Task 12 -> Task 14 -> Task 16 -> Task 17 -> Task 18 -> Task 19 -> Task 20

### Dependency matrix
| Task | Depends on | Blocks | Can parallelize with |
|------|------------|--------|----------------------|
| 1 | none | 20 | 2, 3, 4, 5 |
| 2 | none | 3, 6, 7, 11, 12, 13, 17, 18, 19 | 1, 4, 5 |
| 3 | 2 | 6, 7, 13, 19 | 4, 5 |
| 4 | 2 | 9, 10, 11, 12, 15, 16, 20 | 3, 5 |
| 5 | none | 20 | 1, 2, 3, 4 |
| 6 | 2, 3 | 8, 9, 10, 13, 15, 16, 17 | 7 |
| 7 | 2, 3 | 11, 12, 14, 17 | 6, 8, 9, 10 |
| 8 | 6 | 15, 16 | 7, 9, 10 |
| 9 | 4, 6 | 10, 11, 15, 16 | 7, 8 |
| 10 | 4, 6, 9 | 15, 16 | 7, 8 |
| 11 | 4, 7, 9 | 12 | 13 |
| 12 | 7, 11 | 14, 18, 20 | 13, 15 |
| 13 | 2, 3, 6 | 14, 15, 16, 17, 18 | 11, 12 |
| 14 | 7, 12, 13 | 15, 16 | none |
| 15 | 8, 10, 13, 14 | 17, 19, 20 | 16 |
| 16 | 8, 10, 13, 14 | 17, 19, 20 | 15 |
| 17 | 13, 15, 16 | 18, 19, 20 | none |
| 18 | 12, 13, 17 | 19, 20 | none |
| 19 | 2, 3, 15, 16, 17, 18 | 20 | none |
| 20 | 1, 5, 12, 15, 16, 17, 19 | final | none |

## Todos
> Implementation + Test = ONE task. Never separate.
> Every task MUST have: References + Acceptance Criteria + QA Scenarios + Commit.

- [ ] 1. Git and GitHub bootstrap

  What to do: Initialize `main` branch git history, add `.gitignore` if not already covered by Task 2, and create `code-yeongyu/cursor-proxy` on GitHub when `gh auth status` passes. Use private visibility unless the user has already specified public visibility. Set repository description and topics during creation or immediately after creation.
  Must NOT do: Do not push incomplete product code before the initial scaffold commit exists. Do not fail the whole build if `gh` is unavailable; record a skip with command output.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [20] | Blocked by: []

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/cursor-proxy` — target directory was empty at planning time; bootstrap from scratch.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/package.json:44` — reference repo marks project private.
  - External: `https://cli.github.com/manual/gh_repo_create` — `gh repo create` behavior.
  - External: `https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-topics` — repository topics.

  Acceptance criteria (agent-executable only):
  - [ ] `git status --short --branch` prints `## main` or equivalent initialized branch state.
  - [ ] `git remote -v` contains `github.com:code-yeongyu/cursor-proxy` or `https://github.com/code-yeongyu/cursor-proxy` when GitHub creation succeeds.
  - [ ] `gh repo view code-yeongyu/cursor-proxy --json name,description,visibility,repositoryTopics` succeeds when `gh auth status` succeeds.
  - [ ] `test -s evidence/task-1-git-github.txt`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: local git initialization works
    Tool:     bash
    Steps:    git status --short --branch > evidence/task-1-git-github.txt
    Expected: evidence contains a main branch status line
    Evidence: evidence/task-1-git-github.txt

  Scenario: GitHub unavailable is recorded without blocking local work
    Tool:     bash
    Steps:    gh auth status > evidence/task-1-github-auth.txt 2>&1 || true
    Expected: either authenticated account output or exact unauthenticated failure is captured
    Evidence: evidence/task-1-github-auth.txt
  ```

  Commit: NO | Message: `chore(repo): initialize repository metadata` | Files: [`.git`, GitHub repository metadata]

- [ ] 2. Root monorepo tooling

  What to do: Create root `package.json`, `pnpm-workspace.yaml`, Bun workspace configuration, root scripts, `.gitignore`, `.editorconfig`, workspace directories (`apps/server`, `apps/runner`, `packages/protocol`, `packages/core`, `tests`, `scripts`, `docs`, `evidence`), and lockfiles for both pnpm and Bun. Root scripts must include `test`, `typecheck`, `lint`, `format:check`, `no-excuse`, `build`, `openapi:generate`, `worker:dry-run`, `dev:server`, `dev:runner`, and `qa:http`.
  Must NOT do: Do not choose npm or yarn. Do not add app behavior yet. Do not create placeholder source that bypasses later TDD.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [3, 6, 7, 11, 12, 13, 17, 18, 19] | Blocked by: []

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/package.json:5-18` — root scripts for dev, build dry-run, deploy, test, typecheck, lint, OpenAPI generation.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf/package.json:5-18` — Bun scripts for generate, test, typecheck, lint.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/SKILL.md:20-29` — Bun, pnpm, Biome, Hono, Zod, Bun test stack.
  - External: `https://pnpm.io/workspaces` — `pnpm-workspace.yaml` requirement.
  - External: `https://bun.sh/docs/pm/workspaces` — Bun workspace support.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm install --frozen-lockfile` exits 0.
  - [ ] `bun install --frozen-lockfile` exits 0.
  - [ ] `pnpm -r list --depth -1` shows all four workspace packages.
  - [ ] `bun pm ls --all` exits 0.
  - [ ] `test -f pnpm-lock.yaml && test -f bun.lock`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: pnpm installs reproducibly
    Tool:     bash
    Steps:    pnpm install --frozen-lockfile > evidence/task-2-pnpm-install.txt 2>&1
    Expected: command exits 0 and output has no lockfile mutation prompt
    Evidence: evidence/task-2-pnpm-install.txt

  Scenario: Bun installs reproducibly
    Tool:     bash
    Steps:    bun install --frozen-lockfile > evidence/task-2-bun-install.txt 2>&1
    Expected: command exits 0 and uses existing bun.lock
    Evidence: evidence/task-2-bun-install.txt
  ```

  Commit: YES | Message: `chore(monorepo): scaffold Bun and pnpm workspace` | Files: [`package.json`, `pnpm-workspace.yaml`, `bun.lock`, `pnpm-lock.yaml`, `.gitignore`, `.editorconfig`, `apps/**/package.json`, `packages/**/package.json`]

- [ ] 3. Ultra-strict TypeScript and no-excuse gates

  What to do: Add root `tsconfig.base.json`, package `tsconfig.json` files, `biome.jsonc`, `scripts/check-no-excuse-rules.ts`, and package exports. Configure strict flags and Biome rules to ban `any`, `enum`, non-null assertion, `@ts-ignore`, `@ts-expect-error`, default exports except Worker/Bun runtime entrypoints, and type-only import violations.
  Must NOT do: Do not weaken rules for convenience. Do not allow test files to use `any`; only allow Bun `expect` and test data exceptions.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [6, 7, 13, 19] | Blocked by: [2]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/SKILL.md:31-45` — iron list.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/SKILL.md:112-129` — no-excuse audit.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/references/tsconfig-strict.md:7-50` — strict tsconfig flags.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/references/tsconfig-strict.md:75-144` — Biome rules and CI gate.
  - External: `https://www.typescriptlang.org/tsconfig/strict.html` — strict mode reference.
  - External: `https://biomejs.dev/reference/configuration/` — Biome configuration.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm typecheck` exits 0.
  - [ ] `pnpm lint` exits 0.
  - [ ] `pnpm format:check` exits 0.
  - [ ] `pnpm no-excuse` exits 0.
  - [ ] `printf 'const x: any = 1\n' > /tmp/no-excuse-probe.ts && pnpm no-excuse /tmp/no-excuse-probe.ts` exits non-zero and reports `any`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: strict gates pass on scaffold
    Tool:     bash
    Steps:    pnpm typecheck && pnpm lint && pnpm format:check && pnpm no-excuse
    Expected: all commands exit 0
    Evidence: evidence/task-3-strict-gates.txt

  Scenario: no-excuse rejects forbidden any
    Tool:     bash
    Steps:    printf 'const x: any = 1\n' > /tmp/no-excuse-probe.ts; pnpm no-excuse /tmp/no-excuse-probe.ts > evidence/task-3-no-excuse-error.txt 2>&1
    Expected: command exits non-zero and output includes forbidden any rule id
    Evidence: evidence/task-3-no-excuse-error.txt
  ```

  Commit: YES | Message: `chore(typescript): enforce ultra-strict quality gates` | Files: [`tsconfig.base.json`, `tsconfig.json`, `apps/**/tsconfig.json`, `packages/**/tsconfig.json`, `biome.jsonc`, `scripts/check-no-excuse-rules.ts`]

- [ ] 4. Test harness, fixtures, and mock cursor runner

  What to do: Create shared test helpers, Cursor `stream-json` fixtures, and a deterministic mock cursor runner that can emit assistant text, partial text, thinking, tool calls, usage, and error result events. Tests must use given/when/then naming or helper sections.
  Must NOT do: Do not call the real Cursor CLI in unit tests. Do not use `as any`, non-null assertions, or skipped tests.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [9, 10, 11, 12, 15, 16, 20] | Blocked by: [2]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/tests/helpers/mock-cursor-agent.ts:24-169` — mock event generation for system/user/assistant/tool/result.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/tests/integration/streaming.test.ts:7-27` — fixture-driven stream conversion.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/tests/unit/streaming/openai-sse.test.ts:24-63` — SSE conversion test coverage.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/types.ts:1-98` — event shape source.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm test tests/fixtures/mock-cursor-runner.test.ts` exits 0.
  - [ ] `rg -n "Arrange|Act|Assert" tests apps packages` returns no matches.
  - [ ] `rg -n "given|when|then" tests apps packages` returns matches in new tests.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: mock runner emits deterministic happy path
    Tool:     bash
    Steps:    pnpm test tests/fixtures/mock-cursor-runner.test.ts > evidence/task-4-mock-runner.txt 2>&1
    Expected: test asserts assistant and result usage events are emitted in stable order
    Evidence: evidence/task-4-mock-runner.txt

  Scenario: test suite rejects AAA comments
    Tool:     bash
    Steps:    if rg -n "Arrange|Act|Assert" tests apps packages; then exit 1; fi > evidence/task-4-no-aaa.txt 2>&1
    Expected: command exits 0 with no matches
    Evidence: evidence/task-4-no-aaa.txt
  ```

  Commit: YES | Message: `test(fixtures): add cursor stream-json harness` | Files: [`tests/fixtures/**`, `tests/helpers/**`]

- [ ] 5. Architecture guardrails and repo-local docs baseline

  What to do: Add `AGENTS.md`, `docs/architecture.md`, and `docs/security-and-logging.md` that define the split-runtime architecture, package responsibilities, Worker cannot spawn rule, runner token rule, logging redaction rule, no tool execution MVP rule, and generated docs policy.
  Must NOT do: Do not duplicate README installation docs yet. Do not overpromise unsupported Cursor CLI flags as official; label `--workspace` and `--stream-partial-output` as behavior-source flags requiring real CLI verification.

  Parallelization: Can parallel: YES | Wave 1 | Blocks: [20] | Blocked by: []

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:11-18` — source runtime flow.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:89-105` — usage mapping and streaming finalization behavior.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/src/index.ts:84-134` — edge proxy forwards using Fetch/service binding.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/wrangler.toml:33-37` — service binding pattern.
  - External: `https://docs.cursor.com/en/cli/reference/parameters` — official Cursor parameters; `--workspace` and `--stream-partial-output` not confirmed there during planning.

  Acceptance criteria (agent-executable only):
  - [ ] `test -s AGENTS.md && test -s docs/architecture.md && test -s docs/security-and-logging.md`.
  - [ ] `rg -n "Worker.*spawn|server.*spawn.*cursor-agent" docs AGENTS.md` returns guardrail text saying the server must not spawn Cursor.
  - [ ] `rg -n "undocumented|behavior-source" docs/architecture.md` returns text for `--workspace` and `--stream-partial-output`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: architecture docs state runtime split
    Tool:     bash
    Steps:    rg -n "server.*runner|runner.*cursor-agent|Workers" docs/architecture.md > evidence/task-5-architecture.txt
    Expected: output includes server, runner, cursor-agent, and Workers split
    Evidence: evidence/task-5-architecture.txt

  Scenario: logging docs ban secret and prompt logs
    Tool:     bash
    Steps:    rg -n "prompt|secret|Authorization|token" docs/security-and-logging.md > evidence/task-5-logging.txt
    Expected: output includes explicit no-log rules for prompts, secrets, Authorization, and tokens
    Evidence: evidence/task-5-logging.txt
  ```

  Commit: YES | Message: `docs(architecture): define split runtime guardrails` | Files: [`AGENTS.md`, `docs/architecture.md`, `docs/security-and-logging.md`]

- [ ] 6. OpenAI protocol schemas

  What to do: Implement Zod schemas and readonly TypeScript types for OpenAI-compatible chat completion requests, messages, content parts, tools/tool calls, JSON responses, SSE chunks, usage, errors, `/v1/models`, and shared IDs. Include branded types for request id, model id, runner token, and workspace path where appropriate.
  Must NOT do: Do not model external input as unchecked plain objects. Do not use `any`, `enum`, type assertions, or default exports.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [8, 9, 10, 13, 15, 16, 17] | Blocked by: [2, 3]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/SKILL.md:47-60` — Zod at boundaries and data modeling.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/proxy/formatter.ts:3-60` — OpenAI response/chunk shape.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/usage.ts:12-24` — OpenAI usage shape.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/src/proxy/handler.ts:8-29` — request model/message fields source.
  - External: `https://platform.openai.com/docs/api-reference/chat/create` — OpenAI chat completions request/response reference.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/protocol test` exits 0.
  - [ ] Valid chat request fixture parses and invalid missing `messages` fixture returns a typed validation error.
  - [ ] Tool call schema preserves `function.name` and JSON string `function.arguments`.
  - [ ] `pnpm no-excuse packages/protocol` exits 0.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: valid OpenAI chat request parses
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/protocol test -- openai-protocol > evidence/task-6-openai-protocol.txt 2>&1
    Expected: tests pass for model, messages, stream, tools, usage, and error shapes
    Evidence: evidence/task-6-openai-protocol.txt

  Scenario: invalid request returns validation error
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/protocol test -- openai-invalid > evidence/task-6-openai-invalid.txt 2>&1
    Expected: tests pass and expected error message is `Invalid OpenAI chat completion request`
    Evidence: evidence/task-6-openai-invalid.txt
  ```

  Commit: YES | Message: `feat(protocol): add OpenAI-compatible schemas` | Files: [`packages/protocol/src/openai.ts`, `packages/protocol/src/errors.ts`, `packages/protocol/test/openai.test.ts`]

- [ ] 7. Runner protocol and config schemas

  What to do: Implement runner request/response schema for server-to-runner execution: `POST /runner/v1/execute` accepts request id, model, prompt, workspace, stream preference, and options; response is Cursor `stream-json` as `application/x-ndjson`. Add environment config schemas for server and runner (`CURSOR_PROXY_RUNNER_URL`, `CURSOR_PROXY_RUNNER_TOKEN`, `CURSOR_AGENT_BIN`, `CURSOR_PROXY_DEFAULT_WORKSPACE`, `PORT`, allowed origins if needed).
  Must NOT do: Do not expose runner without token validation. Do not put prompt or token values in config parse errors.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [11, 12, 14, 17] | Blocked by: [2, 3]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:754-779` — Cursor spawn contract and stdin prompt behavior.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/src/index.ts:95-114` — edge proxy builds authenticated upstream Request without reading body.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/SKILL.md:41-42` — Zod at boundaries and typed errors.
  - External: `https://docs.cursor.com/en/cli/reference/output-format` — `stream-json` is newline-delimited JSON ending in result event.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/protocol test -- runner-protocol` exits 0.
  - [ ] Missing runner token config returns typed config error without printing token value.
  - [ ] Runner request fixture serializes to JSON with no `undefined` fields.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: runner execution request parses
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/protocol test -- runner-protocol > evidence/task-7-runner-protocol.txt 2>&1
    Expected: tests pass for request id, model, workspace, prompt, stream flag, and token config
    Evidence: evidence/task-7-runner-protocol.txt

  Scenario: missing token is rejected safely
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/protocol test -- runner-config-error > evidence/task-7-runner-config-error.txt 2>&1
    Expected: tests pass and output contains `CURSOR_PROXY_RUNNER_TOKEN is required` without token values
    Evidence: evidence/task-7-runner-config-error.txt
  ```

  Commit: YES | Message: `feat(protocol): add runner execution contract` | Files: [`packages/protocol/src/runner.ts`, `packages/protocol/src/config.ts`, `packages/protocol/test/runner.test.ts`]

- [ ] 8. Prompt builder and model normalization

  What to do: Implement core prompt builder that converts OpenAI messages into Cursor stdin text and model normalization that strips configured provider prefixes and honors `cursorModel` when present. Cover system, user, assistant, tool results, array content parts, empty content, and unsupported content parts.
  Must NOT do: Do not include tool execution. Do not mutate input message arrays. Do not log prompt output in tests beyond fixture assertions.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [15, 16] | Blocked by: [6]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/proxy/handler.ts:8-29` — simple model prefix stripping and message-to-prompt baseline.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:54-64` — `cursorModel` precedence over provider-prefixed model.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:16-17` — tool results become `role: "tool"` messages in next turn.
  - Test:     `/Users/yeongyu/local-workspaces/opencode-cursor/tests/unit/proxy/prompt-builder.test.ts` — reference location for prompt builder coverage if executor wants more examples.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/core test -- prompt` exits 0.
  - [ ] Given `model: "cursor-proxy/gpt-5.3-codex"` and no `cursorModel`, normalized model is `gpt-5.3-codex`.
  - [ ] Given `cursorModel: "composer-2.5-fast"`, normalized model is `composer-2.5-fast`.
  - [ ] Given system/user/tool messages, prompt includes role-labeled sections and tool call ids.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: prompt builder handles mixed messages
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- prompt-builder > evidence/task-8-prompt-builder.txt 2>&1
    Expected: tests pass for system, user, assistant, tool, and content-part messages
    Evidence: evidence/task-8-prompt-builder.txt

  Scenario: unsupported content part is skipped deterministically
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- prompt-unsupported-content > evidence/task-8-prompt-edge.txt 2>&1
    Expected: tests pass and unsupported part produces no `undefined` or `[object Object]` text
    Evidence: evidence/task-8-prompt-edge.txt
  ```

  Commit: YES | Message: `feat(core): build cursor prompts from OpenAI messages` | Files: [`packages/core/src/prompt.ts`, `packages/core/src/model.ts`, `packages/core/test/prompt.test.ts`]

- [ ] 9. Stream-json parser, line buffer, and usage mapper

  What to do: Implement strict Cursor `stream-json` event schemas, safe NDJSON line parsing, line buffering for chunked streams, result/error detection, and Cursor usage to OpenAI usage mapping. Preserve unknown Cursor event fields via `unknown` record passthrough where needed.
  Must NOT do: Do not cast parsed JSON into event types without Zod narrowing. Do not invent zero usage when Cursor omits usage.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [10, 11, 15, 16] | Blocked by: [4, 6]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/parser.ts:6-22` — trim, parse, ignore empty/invalid lines.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/types.ts:1-98` — system/user/assistant/thinking/tool/result event shapes.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/usage.ts:26-96` — usage normalization.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:91-105` — usage mapping and omit behavior.
  - Test:     `/Users/yeongyu/local-workspaces/opencode-cursor/tests/integration/streaming.test.ts:62-69` — error result fixture parse.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/core test -- stream-json` exits 0.
  - [ ] Invalid JSON line returns typed parse failure or null without throwing.
  - [ ] Usage maps `inputTokens + cacheReadTokens + cacheWriteTokens` to `prompt_tokens`.
  - [ ] Missing usage returns `undefined`, not zero usage.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: parser handles fixture stream
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- stream-json-parser > evidence/task-9-stream-parser.txt 2>&1
    Expected: tests pass for assistant, thinking, tool_call, result, and invalid line cases
    Evidence: evidence/task-9-stream-parser.txt

  Scenario: usage mapper omits missing usage
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- usage-mapper > evidence/task-9-usage.txt 2>&1
    Expected: tests pass and omitted usage is asserted as undefined
    Evidence: evidence/task-9-usage.txt
  ```

  Commit: YES | Message: `feat(core): parse cursor stream-json events` | Files: [`packages/core/src/stream-json.ts`, `packages/core/src/line-buffer.ts`, `packages/core/src/usage.ts`, `packages/core/test/stream-json.test.ts`, `packages/core/test/usage.test.ts`]

- [ ] 10. OpenAI JSON/SSE formatter and converter

  What to do: Implement OpenAI-compatible `chat.completion`, `chat.completion.chunk`, usage chunk, SSE framing, final stop chunk, `[DONE]`, assistant text deltas, thinking `reasoning_content`, tool call deltas, and duplicate suppression for partial events followed by final accumulated events.
  Must NOT do: Do not buffer streaming output in SSE conversion. Do not emit duplicate final accumulated text when partials already streamed.

  Parallelization: Can parallel: YES | Wave 2 | Blocks: [15, 16] | Blocked by: [4, 6, 9]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/openai-sse.ts:55-57` — SSE `data:` and `[DONE]` framing.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/openai-sse.ts:59-143` — stream event to SSE chunk converter.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/proxy/formatter.ts:3-60` — OpenAI response and chunk builders.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/usage.ts:98-111` — usage-only SSE chunk.
  - Test:     `/Users/yeongyu/local-workspaces/opencode-cursor/tests/unit/streaming/openai-sse.test.ts:107-193` — duplicate suppression tests.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/core test -- openai-converter` exits 0.
  - [ ] SSE chunks start with `data: ` and end with blank line.
  - [ ] Final stream order is content chunks, stop chunk, optional usage chunk, `[DONE]`.
  - [ ] Partial assistant/thinking events are not duplicated by final accumulated events.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: assistant stream converts to OpenAI SSE
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- openai-sse > evidence/task-10-openai-sse.txt 2>&1
    Expected: tests pass and output contains `chat.completion.chunk`, `delta.content`, and `[DONE]`
    Evidence: evidence/task-10-openai-sse.txt

  Scenario: duplicate partial/final text is suppressed
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/core test -- partial-duplicate-suppression > evidence/task-10-duplicate-suppression.txt 2>&1
    Expected: tests pass and final accumulated event emits no content after partials
    Evidence: evidence/task-10-duplicate-suppression.txt
  ```

  Commit: YES | Message: `feat(core): convert cursor streams to OpenAI responses` | Files: [`packages/core/src/openai-format.ts`, `packages/core/src/openai-sse.ts`, `packages/core/test/openai-format.test.ts`, `packages/core/test/openai-sse.test.ts`]

- [ ] 11. Cursor process adapter

  What to do: Implement runner-side process adapter that spawns Cursor CLI, writes prompt to stdin, returns stdout as a `ReadableStream<Uint8Array>`, captures stderr for errors, propagates abort signals, and supports configurable binary path. Spawn argv must include `--print --output-format stream-json --stream-partial-output --workspace <dir> --model <model>` for behavioral parity, with real CLI verification documenting whether undocumented flags work in the installed Cursor version.
  Must NOT do: Do not use Node-only spawn code in server package. Do not pass prompt as argv. Do not log prompt or stderr bodies unless redacted.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [12] | Blocked by: [4, 7, 9]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:754-779` — spawn argv and stdin prompt write.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:781-790` — stdout/stderr and exit code collection for non-stream.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/tests/helpers/mock-cursor-agent.ts:171-226` — mock process behavior.
  - External: `https://docs.cursor.com/en/cli/reference/parameters` — official `--print`, `--output-format`, `--model`.
  - External: `https://docs.cursor.com/en/cli/reference/output-format` — stream-json output contract.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/runner test -- process-adapter` exits 0.
  - [ ] Mock spawn receives argv in exact order: binary, `--print`, `--output-format`, `stream-json`, `--stream-partial-output`, `--workspace`, workspace, `--model`, model.
  - [ ] Prompt is written to stdin, not argv.
  - [ ] Aborted request terminates child process and returns typed abort error.
  - [ ] Real CLI probe command records installed support or skip in evidence without failing when Cursor is absent.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: adapter spawns cursor-agent-compatible argv
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/runner test -- process-adapter > evidence/task-11-process-adapter.txt 2>&1
    Expected: tests pass with exact argv and stdin prompt assertions
    Evidence: evidence/task-11-process-adapter.txt

  Scenario: real Cursor CLI flag support is probed
    Tool:     bash
    Steps:    (command -v cursor-agent && cursor-agent --help || command -v cursor && cursor agent --help || true) > evidence/task-11-cursor-cli-probe.txt 2>&1
    Expected: evidence records help output or command-not-found skip
    Evidence: evidence/task-11-cursor-cli-probe.txt
  ```

  Commit: YES | Message: `feat(runner): spawn cursor agent streams` | Files: [`apps/runner/src/process-adapter.ts`, `apps/runner/test/process-adapter.test.ts`]

- [ ] 12. Runner HTTP app and CLI mode

  What to do: Implement Hono runner app and Bun CLI entrypoint. Routes: `GET /health`, `POST /runner/v1/execute`, and `GET /runner/v1/models` if model discovery is configured. Validate bearer token, parse runner request with Zod, call process adapter, return `application/x-ndjson` stream, and return typed JSON errors for auth/config/spawn failures.
  Must NOT do: Do not expose execution endpoint without token. Do not require Cloudflare Workers APIs in runner. Do not swallow cursor exit failures.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [14, 18, 20] | Blocked by: [7, 11]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/src/index.ts:32-41` — Hono health and route mounting.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:695-700` — unsupported path returns JSON 404.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:1107-1114` — streaming response headers.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/types.ts:74-90` — result/error event shape.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/runner test -- runner-http` exits 0.
  - [ ] `GET /health` returns 200 JSON with status and mode.
  - [ ] Missing bearer token returns 401 with exact `Runner token is required`.
  - [ ] Valid execute request streams mock NDJSON with content type `application/x-ndjson`.
  - [ ] Spawn failure returns 502 typed JSON error.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: runner streams mock cursor NDJSON over HTTP
    Tool:     curl
    Steps:    pnpm --filter @cursor-proxy/runner test -- runner-http > evidence/task-12-runner-http.txt 2>&1
    Expected: tests pass and assert 200, application/x-ndjson, and final result event
    Evidence: evidence/task-12-runner-http.txt

  Scenario: unauthorized runner request fails
    Tool:     curl
    Steps:    pnpm --filter @cursor-proxy/runner test -- runner-unauthorized > evidence/task-12-runner-unauthorized.txt 2>&1
    Expected: tests pass and assert 401 `Runner token is required`
    Evidence: evidence/task-12-runner-unauthorized.txt
  ```

  Commit: YES | Message: `feat(runner): expose authenticated cursor execution API` | Files: [`apps/runner/src/app.ts`, `apps/runner/src/index.ts`, `apps/runner/src/config.ts`, `apps/runner/test/runner-http.test.ts`]

- [ ] 13. Server Hono app foundation

  What to do: Implement Workers-compatible Hono app skeleton with config loading, structured redacting logger, request id middleware, CORS/options if needed for OpenAI SDK clients, `/health`, `/v1/models`, typed errors, and not-found behavior. Export `app` and Worker default fetch entrypoint.
  Must NOT do: Do not import `node:*`, `child_process`, Bun-only APIs, or runner process adapter from the server package. Do not log prompts or Authorization headers.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [14, 15, 16, 17, 18] | Blocked by: [2, 3, 6]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/src/index.ts:11-30` — Hono app, request logging, error handler.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/src/index.ts:32-59` — health, routes, notFound.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/src/index.ts:84-134` — Worker-style default fetch.
  - External: `https://hono.dev/docs/getting-started/cloudflare-workers` — Hono Cloudflare Workers deployment.
  - External: `https://developers.cloudflare.com/workers/runtime-apis/response/` — Workers Response streaming.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/server test -- app-foundation` exits 0.
  - [ ] Server package has no `node:` or `child_process` imports: `rg -n "node:|child_process|Bun\\.spawn" apps/server packages/core packages/protocol` returns no matches.
  - [ ] `/health` returns 200 JSON.
  - [ ] Unknown route returns 404 JSON with request id.
  - [ ] Logger redaction test proves prompts and Authorization headers are absent.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: server health and 404 are Worker-compatible
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- app-foundation > evidence/task-13-server-foundation.txt 2>&1
    Expected: tests pass for health, models, 404, typed errors, and request ids
    Evidence: evidence/task-13-server-foundation.txt

  Scenario: server contains no process-spawn imports
    Tool:     bash
    Steps:    if rg -n "node:|child_process|Bun\\.spawn" apps/server packages/core packages/protocol; then exit 1; fi > evidence/task-13-no-spawn.txt 2>&1
    Expected: command exits 0 with no matches
    Evidence: evidence/task-13-no-spawn.txt
  ```

  Commit: YES | Message: `feat(server): add Worker-compatible Hono foundation` | Files: [`apps/server/src/app.ts`, `apps/server/src/worker.ts`, `apps/server/src/config.ts`, `apps/server/src/logger.ts`, `apps/server/test/app-foundation.test.ts`]

- [ ] 14. Server runner HTTP client

  What to do: Implement server-side runner client using `fetch`, bearer token auth, timeout/abort propagation, typed HTTP errors, NDJSON stream passthrough, and config-driven runner base URL. Include tests with mock runner `fetch`.
  Must NOT do: Do not buffer runner stream unless caller asks for non-stream route aggregation. Do not retry non-idempotent runner execution automatically.

  Parallelization: Can parallel: NO | Wave 3 | Blocks: [15, 16] | Blocked by: [7, 12, 13]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/src/index.ts:108-120` — construct Request and forward with fetch/service binding fallback.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/src/index.ts:127-133` — error hook then rethrow pattern.
  - API/Type: `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/parser.ts:6-22` — downstream parse expectations.
  - External: `https://developers.cloudflare.com/workers/runtime-apis/fetch/` — Workers fetch API.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/server test -- runner-client` exits 0.
  - [ ] Client sets Authorization bearer header and does not expose token in thrown error message.
  - [ ] Runner 401 maps to 502 OpenAI-compatible upstream error for public API callers.
  - [ ] Abort signal cancels fetch.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: runner client streams successful NDJSON
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- runner-client-success > evidence/task-14-runner-client.txt 2>&1
    Expected: tests pass and assert streamed NDJSON remains readable
    Evidence: evidence/task-14-runner-client.txt

  Scenario: runner auth failure maps safely
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- runner-client-auth-error > evidence/task-14-runner-client-error.txt 2>&1
    Expected: tests pass and assert 502 public error without token leakage
    Evidence: evidence/task-14-runner-client-error.txt
  ```

  Commit: YES | Message: `feat(server): call authenticated runner service` | Files: [`apps/server/src/runner-client.ts`, `apps/server/test/runner-client.test.ts`]

- [ ] 15. Non-streaming `/v1/chat/completions`

  What to do: Implement non-stream OpenAI chat completions route. Validate request, build prompt, normalize model, call runner, parse full NDJSON, aggregate assistant text/thinking as needed, detect result usage/error, and return OpenAI `chat.completion` JSON. Include invalid JSON/body/model/messages tests and runner failure tests.
  Must NOT do: Do not stream this route. Do not return raw Cursor events. Do not invent usage when absent.

  Parallelization: Can parallel: YES | Wave 3 | Blocks: [17, 19, 20] | Blocked by: [8, 10, 13, 14]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:781-820` — non-stream collects stdout/stderr and builds response.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/proxy/formatter.ts:3-38` — chat completion JSON shape.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/usage.ts:93-96` — result usage extraction.
  - Test:     `/Users/yeongyu/local-workspaces/opencode-cursor/tests/proxy/http.test.ts:36-81` — request parsing and invalid body cases.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/server test -- chat-nonstream` exits 0.
  - [ ] Valid request returns 200, `object: "chat.completion"`, assistant message content, model, and usage when fixture has usage.
  - [ ] Invalid JSON returns 400 with exact `Invalid JSON request body`.
  - [ ] Missing messages returns 400 with exact `Invalid OpenAI chat completion request`.
  - [ ] Runner error result returns 502 with typed OpenAI-compatible error.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: non-stream chat returns OpenAI JSON
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- chat-nonstream-success > evidence/task-15-chat-nonstream.txt 2>&1
    Expected: tests pass and assert chat.completion JSON content and usage
    Evidence: evidence/task-15-chat-nonstream.txt

  Scenario: invalid request is rejected
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- chat-nonstream-invalid > evidence/task-15-chat-nonstream-error.txt 2>&1
    Expected: tests pass and assert 400 exact error messages
    Evidence: evidence/task-15-chat-nonstream-error.txt
  ```

  Commit: YES | Message: `feat(server): serve non-stream OpenAI chat completions` | Files: [`apps/server/src/routes/chat-completions.ts`, `apps/server/test/chat-nonstream.test.ts`]

- [ ] 16. Streaming `/v1/chat/completions` SSE

  What to do: Implement streaming route for `stream: true`. Validate request, call runner, parse NDJSON incrementally with line buffer, convert events into OpenAI SSE chunks, emit final stop chunk, optional usage chunk, and `[DONE]`. Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and appropriate keepalive/Workers-compatible headers.
  Must NOT do: Do not wait for full runner completion before sending the first SSE chunk. Do not use Node streams in server package.

  Parallelization: Can parallel: YES | Wave 4 | Blocks: [17, 19, 20] | Blocked by: [8, 10, 13, 14]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:1092-1098` — final stop chunk, usage chunk, `[DONE]`.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/plugin.ts:1107-1114` — SSE response headers.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/src/streaming/openai-sse.ts:76-115` — event to SSE deltas.
  - External: `https://hono.dev/docs/helpers/streaming` — Hono streaming helpers.
  - External: `https://developers.cloudflare.com/workers/runtime-apis/response/` — ReadableStream response behavior.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm --filter @cursor-proxy/server test -- chat-stream` exits 0.
  - [ ] First SSE event is emitted before mock runner result event completes.
  - [ ] Response content type includes `text/event-stream`.
  - [ ] Stream includes assistant deltas, final stop chunk, usage chunk when present, and `[DONE]`.
  - [ ] Runner mid-stream error emits OpenAI-compatible SSE error or terminates with non-2xx before body starts as defined by implementation tests.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: streaming chat returns OpenAI SSE
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- chat-stream-success > evidence/task-16-chat-stream.txt 2>&1
    Expected: tests pass and assert text/event-stream, data chunks, stop chunk, usage chunk, and [DONE]
    Evidence: evidence/task-16-chat-stream.txt

  Scenario: partial events are not duplicated over HTTP
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- chat-stream-partials > evidence/task-16-chat-stream-partials.txt 2>&1
    Expected: tests pass and assert combined content equals expected text exactly once
    Evidence: evidence/task-16-chat-stream-partials.txt
  ```

  Commit: YES | Message: `feat(server): stream OpenAI chat completions over SSE` | Files: [`apps/server/src/routes/chat-completions.ts`, `apps/server/test/chat-stream.test.ts`]

- [ ] 17. OpenAPI, Scalar, Swagger, and generated docs

  What to do: Add OpenAPI route metadata for health, models, runner status where public, and chat completions. Serve `/openapi.json`, `/docs/scalar`, `/docs/swagger`. Add `scripts/generate-openapi.ts` that writes `docs/generated/openapi.json`, `docs/generated/scalar.html`, and `docs/generated/swagger.html` from the running app or route generator.
  Must NOT do: Do not hand-edit generated files after the script writes them. Do not omit streaming request/response documentation.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [18, 19, 20] | Blocked by: [13, 15, 16]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/references/backend-hono.md:1-5` — Hono + `hono-openapi` + Scalar + Swagger stack.
  - Pattern:  `/Users/yeongyu/.agents/skills/typescript-programmer/references/backend-hono.md:135-174` — `/openapi.json`, Scalar, Swagger route pattern.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/src/routes/docs.ts:12-28` — docs redirect and OpenAPI JSON route.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/scripts/generate-openapi.ts:79-114` — generate spec plus Scalar/Swagger HTML.
  - External: `https://hono.dev/examples/hono-openapi` — Hono OpenAPI example.
  - External: `https://hono.dev/examples/scalar` — Scalar Hono integration.
  - External: `https://hono.dev/examples/swagger-ui` — Swagger UI Hono integration.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm openapi:generate` exits 0 and writes all three generated docs files.
  - [ ] `jq -e '.paths["/v1/chat/completions"].post' docs/generated/openapi.json` exits 0.
  - [ ] `pnpm --filter @cursor-proxy/server test -- docs-routes` exits 0.
  - [ ] `curl` QA against local server returns 200 for `/openapi.json`, `/docs/scalar`, and `/docs/swagger`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: generated OpenAPI includes chat completions
    Tool:     bash
    Steps:    pnpm openapi:generate && jq -e '.paths["/v1/chat/completions"].post' docs/generated/openapi.json > evidence/task-17-openapi.txt 2>&1
    Expected: command exits 0 and generated spec includes POST /v1/chat/completions
    Evidence: evidence/task-17-openapi.txt

  Scenario: docs routes render
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server test -- docs-routes > evidence/task-17-docs-routes.txt 2>&1
    Expected: tests pass for OpenAPI JSON, Scalar HTML, and Swagger HTML
    Evidence: evidence/task-17-docs-routes.txt
  ```

  Commit: YES | Message: `feat(docs): publish OpenAPI with Scalar and Swagger` | Files: [`apps/server/src/openapi.ts`, `apps/server/src/routes/docs.ts`, `scripts/generate-openapi.ts`, `docs/generated/**`, `apps/server/test/docs-routes.test.ts`]

- [ ] 18. Cloudflare Workers packaging and runtime modes

  What to do: Add `wrangler.toml`, Worker entrypoint, package build scripts, local server CLI entrypoint if separate from Worker, runner CLI entrypoint, and smoke tests proving server package is Workers-compatible while runner package remains Bun/local only. `worker:dry-run` must run OpenAPI generation and `wrangler deploy --dry-run`.
  Must NOT do: Do not include runner code in Worker bundle. Do not require Cloudflare account secrets for local dry-run unless Wrangler requires them; capture skip/failure explicitly.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [19, 20] | Blocked by: [12, 13, 17]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/wrangler.toml:1-4` — Worker name/main/compatibility setup.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/package.json:5-13` — `build` dry-run and OpenAPI generate scripts.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/.github/workflows/deploy.yml:56-57` — CI dry-run command.
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf-proxy/package.json:5-9` — Wrangler dev/deploy scripts.
  - External: `https://developers.cloudflare.com/workers/wrangler/commands/#deploy` — Wrangler deploy and dry-run reference.

  Acceptance criteria (agent-executable only):
  - [ ] `pnpm worker:dry-run` exits 0 or records a Cloudflare-auth-specific failure in `evidence/task-18-worker-dry-run.txt`.
  - [ ] `pnpm --filter @cursor-proxy/server build` exits 0.
  - [ ] `pnpm --filter @cursor-proxy/runner build` exits 0.
  - [ ] Bundle/import scan proves `apps/server` does not reference `apps/runner` or `child_process`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: Worker dry-run command executes
    Tool:     bash
    Steps:    pnpm worker:dry-run > evidence/task-18-worker-dry-run.txt 2>&1 || true
    Expected: output contains successful dry-run result or exact Cloudflare auth/config failure; no TypeScript/build failure
    Evidence: evidence/task-18-worker-dry-run.txt

  Scenario: server bundle excludes runner process code
    Tool:     bash
    Steps:    pnpm --filter @cursor-proxy/server build && if rg -n "child_process|Bun\\.spawn|apps/runner|process-adapter" apps/server dist; then exit 1; fi > evidence/task-18-worker-bundle.txt 2>&1
    Expected: command exits 0 with no process-spawn references in server output
    Evidence: evidence/task-18-worker-bundle.txt
  ```

  Commit: YES | Message: `build(worker): package server for Cloudflare Workers` | Files: [`wrangler.toml`, `apps/server/src/index.ts`, `apps/server/src/worker.ts`, `apps/runner/src/index.ts`, `apps/**/package.json`]

- [ ] 19. CI quality gates and deploy dry-run

  What to do: Add GitHub Actions workflow(s) for pnpm primary install, Bun compatibility install, typecheck, lint, format check, no-excuse, tests, OpenAPI generation, build, and Wrangler deploy dry-run. Cache pnpm and Bun dependencies. Use job names that Task 20 can require in branch rules.
  Must NOT do: Do not add real production deploy yet. Do not require secrets for PR CI except optional dry-run auth handling.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [20] | Blocked by: [2, 3, 15, 16, 17, 18]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/ccapi/ccapi-cf/.github/workflows/ci-sourcecode.yml:35-61` — setup Bun, cache, install, typecheck, lint, format, tests.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/.github/workflows/deploy.yml:29-57` — setup Node/Bun, install, typecheck, tests, build dry-run.
  - External: `https://github.com/pnpm/action-setup` — pnpm setup action.
  - External: `https://github.com/actions/setup-node` — setup-node pnpm cache support.
  - External: `https://github.com/oven-sh/setup-bun` — Bun setup action.

  Acceptance criteria (agent-executable only):
  - [ ] `actionlint .github/workflows/ci.yml` exits 0 when `actionlint` is installed; otherwise evidence records skip.
  - [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm no-excuse && pnpm test && pnpm openapi:generate` exits 0.
  - [ ] `bun install --frozen-lockfile && bun test` exits 0.
  - [ ] Workflow contains required job names `quality`, `bun-compat`, and `worker-dry-run`.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: local CI command chain passes
    Tool:     bash
    Steps:    pnpm typecheck && pnpm lint && pnpm format:check && pnpm no-excuse && pnpm test && pnpm openapi:generate > evidence/task-19-local-ci.txt 2>&1
    Expected: command chain exits 0
    Evidence: evidence/task-19-local-ci.txt

  Scenario: workflow syntax is valid or skip is captured
    Tool:     bash
    Steps:    (command -v actionlint && actionlint .github/workflows/ci.yml || echo "actionlint unavailable") > evidence/task-19-actionlint.txt 2>&1
    Expected: either actionlint exits 0 or evidence records unavailable tool
    Evidence: evidence/task-19-actionlint.txt
  ```

  Commit: YES | Message: `ci: add quality gates and Worker dry-run` | Files: [`.github/workflows/ci.yml`]

- [ ] 20. README, manual QA, GitHub rules, and release tag

  What to do: Write README and docs for architecture, local same-machine setup, remote runner setup, Cloudflare Workers deployment, OpenAI SDK/curl examples, environment variables, Cursor CLI flag caveat, troubleshooting, and release process. Add `scripts/qa-http.sh` or equivalent executable QA script that starts mock runner and server, exercises health/docs/non-stream/SSE with curl, captures evidence, and stops processes. Apply GitHub branch rules requiring `quality`, `bun-compat`, and `worker-dry-run` checks when `gh` auth allows it. Create annotated `v0.1.0` tag only after all final verification passes.
  Must NOT do: Do not leave long-running tmux sessions/processes alive. Do not create a release tag before tests and manual QA pass. Do not claim real Cursor CLI flags are official if only behavior-source verified.

  Parallelization: Can parallel: NO | Wave 4 | Blocks: [final] | Blocked by: [1, 5, 12, 15, 16, 17, 19]

  References (executor has NO interview context — be exhaustive):
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/README.md:164-169` — architecture diagram concept for proxy spawn and SSE.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:11-18` — runtime flow to document.
  - Pattern:  `/Users/yeongyu/local-workspaces/opencode-cursor/docs/architecture/runtime-tool-loop.md:111-115` — operational notes style.
  - Pattern:  `/Users/yeongyu/local-workspaces/apitopia/.github/workflows/deploy.yml:56-57` — dry-run command to document.
  - External: `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets` — GitHub rulesets.
  - External: `https://git-scm.com/book/en/v2/Git-Basics-Tagging` — annotated tag convention.

  Acceptance criteria (agent-executable only):
  - [ ] `test -s README.md && test -s docs/deployment.md && test -s docs/release.md`.
  - [ ] `pnpm qa:http` exits 0 and writes curl status/body evidence for health, docs, non-stream chat, streaming chat, invalid JSON, and unauthorized runner.
  - [ ] `tmux ls` after QA does not show `cursor-proxy-qa-runner` or `cursor-proxy-qa-server`.
  - [ ] `gh api repos/code-yeongyu/cursor-proxy/rulesets` shows branch rules when GitHub setup succeeds, or evidence records auth/API skip.
  - [ ] `git tag -n | rg '^v0.1.0\\s+Initial production-ready cursor-proxy scaffold'` passes after final verification.

  QA scenarios (MANDATORY — task incomplete without these):
  ```
  Scenario: manual HTTP QA exercises real local surfaces
    Tool:     curl
    Steps:    pnpm qa:http > evidence/task-20-manual-http-qa.txt 2>&1
    Expected: script exits 0; evidence includes HTTP 200 health, HTTP 200 OpenAPI, HTTP 200 non-stream completion body, SSE data chunks plus [DONE], HTTP 400 invalid JSON, and HTTP 401 unauthorized runner
    Evidence: evidence/task-20-manual-http-qa.txt

  Scenario: GitHub branch rules and tag are applied or skip is recorded
    Tool:     bash
    Steps:    (gh api repos/code-yeongyu/cursor-proxy/rulesets && git tag -n) > evidence/task-20-github-rules-tags.txt 2>&1 || true
    Expected: evidence contains rulesets and v0.1.0 tag, or exact GitHub auth/API skip reason
    Evidence: evidence/task-20-github-rules-tags.txt
  ```

  Commit: YES | Message: `docs: document operations and manual QA` | Files: [`README.md`, `docs/deployment.md`, `docs/release.md`, `scripts/qa-http.sh`, GitHub ruleset metadata, git tag `v0.1.0`]

## Final verification wave (MANDATORY — after all implementation tasks)
> Runs in PARALLEL. ALL must APPROVE. Surface results to the caller and wait for an explicit "okay" before declaring complete.
- [ ] F1. Plan compliance audit — every task done, every acceptance criterion met
- [ ] F2. Code quality review — diagnostics clean, idioms match, no dead code
- [ ] F3. Real manual QA — every QA scenario executed with evidence captured
- [ ] F4. Scope fidelity — nothing extra shipped beyond Must-Have, nothing Must-NOT-Have introduced

## Commit strategy
- One logical change per commit. Conventional Commits (`<type>(<scope>): <subject>` body + footer).
- Atomic: every commit builds and passes tests on its own.
- No "WIP" / "fix typo squash later" commits on the final branch — clean up before merge.
- Reference the plan file path in the final commit footer: `Plan: plans/cursor-proxy-ulw.md`.
- Recommended commit order:
  - `chore(monorepo): scaffold Bun and pnpm workspace`
  - `chore(typescript): enforce ultra-strict quality gates`
  - `test(fixtures): add cursor stream-json harness`
  - `docs(architecture): define split runtime guardrails`
  - `feat(protocol): add OpenAI-compatible schemas`
  - `feat(protocol): add runner execution contract`
  - `feat(core): build cursor prompts from OpenAI messages`
  - `feat(core): parse cursor stream-json events`
  - `feat(core): convert cursor streams to OpenAI responses`
  - `feat(runner): spawn cursor agent streams`
  - `feat(runner): expose authenticated cursor execution API`
  - `feat(server): add Worker-compatible Hono foundation`
  - `feat(server): call authenticated runner service`
  - `feat(server): serve non-stream OpenAI chat completions`
  - `feat(server): stream OpenAI chat completions over SSE`
  - `feat(docs): publish OpenAPI with Scalar and Swagger`
  - `build(worker): package server for Cloudflare Workers`
  - `ci: add quality gates and Worker dry-run`
  - `docs: document operations and manual QA`
- Tag only after F1-F4 approve: `git tag -a v0.1.0 -m "Initial production-ready cursor-proxy scaffold"`.

## Success criteria
- All Must-Have shipped; all QA scenarios pass with captured evidence; F1-F4 approved; commit history clean.
