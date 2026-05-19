# cursor-proxy

OpenAI-compatible `/v1/chat/completions` proxy for Cursor CLI.

## What It Runs

- `apps/server`: Hono API surface for Cloudflare Workers, Bun, or other Web API runtimes.
- `apps/runner`: local HTTP runner for a machine that can execute `cursor agent`.
- `packages/shared`: OpenAI request/response schemas, prompt rendering, Cursor stream-json conversion, SSE formatting.

The server can run in Cloudflare Workers while the runner runs on a Mac mini or another client machine with Cursor CLI installed. A single-machine setup is also supported by running both services locally.

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | service health |
| `GET /v1/models` | minimal Cursor model list |
| `POST /v1/chat/completions` | OpenAI-compatible chat completions |
| `GET /openapi.json` | OpenAPI document |
| `GET /scalar` | Scalar docs |
| `GET /swagger` | Swagger UI |

## Local Development

```bash
bun install
bun test
bun run check
```

pnpm is supported for workspace installs and script orchestration:

```bash
pnpm install
pnpm check
```

Run runner:

```bash
PORT=8791 CURSOR_WORKSPACE=/path/to/workspace bun --filter @cursor-proxy/runner dev
```

Run server against runner:

```bash
PORT=8787 CURSOR_RUNNER_URL=http://127.0.0.1:8791 bun --filter @cursor-proxy/server dev
```

Run the same server on Node after building with pnpm:

```bash
pnpm node:build
PORT=8787 CURSOR_RUNNER_URL=http://127.0.0.1:8791 pnpm node:start
```

Manual request:

```bash
curl -s http://127.0.0.1:8787/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"cursor-acp/auto","messages":[{"role":"user","content":"Say hi"}]}'
```

Live Composer 2.5 tool-call QA is intentionally opt-in because it spends real Cursor quota:

```bash
bun run live:composer-toolcall
```

## Deployment

Cloudflare Workers should deploy `apps/server/src/worker.ts`. Configure:

| Env | Meaning |
| --- | --- |
| `CURSOR_RUNNER_URL` | HTTPS URL of the runner machine |
| `CURSOR_RUNNER_TOKEN` | optional bearer token shared with runner |
| `CURSOR_PROXY_LOG_LEVEL` | `debug`, `info`, `warn`, `error` |

Runner machine config:

| Env | Meaning |
| --- | --- |
| `PORT` | runner port, default `8791` |
| `CURSOR_BINARY` | cursor binary path, default `cursor` |
| `CURSOR_WORKSPACE` | default workspace passed to `cursor agent --workspace` |
| `CURSOR_RUNNER_TOKEN` | optional bearer token required by `/run` |

## Repository Policy

- Default branch: `main`.
- Required checks: `bun`, `pnpm-node`, `cloudflare-workers`.
- Branch rules: require PR review, require status checks, require branch up to date, require review thread resolution, block force pushes, block deletion.
- Topics: `cursor`, `openai-compatible`, `hono`, `cloudflare-workers`, `bun`, `pnpm`, `typescript`.
