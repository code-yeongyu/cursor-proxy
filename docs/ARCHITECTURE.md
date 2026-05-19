# Architecture

```text
OpenAI-compatible client
  -> apps/server /v1/chat/completions
  -> apps/runner /run
  -> cursor agent --print --output-format stream-json --stream-partial-output
  -> Cursor API
```

`apps/server` owns the public API contract. It validates OpenAI request bodies with Zod, renders chat messages into the prompt format Cursor CLI accepts, then delegates to a runner.

`apps/runner` owns local process execution. It writes the prompt to stdin to avoid command-line length limits, reads Cursor `stream-json`, and emits normalized newline-delimited runner events.

`packages/shared` owns protocol code so both sides use the same schemas and stream conversion rules.

