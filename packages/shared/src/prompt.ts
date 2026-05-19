import type { ChatCompletionRequest, ChatMessage, TextContentPart } from "./openai.js"

function isTextPart(value: TextContentPart): boolean {
  return value.type === "text" && value.text.length > 0
}

function renderContent(message: ChatMessage): string {
  const content = message.content
  if (typeof content === "string") {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .filter(isTextPart)
      .map((part) => part.text)
      .join("\n")
  }
  return ""
}

function renderToolCalls(message: ChatMessage): string {
  const calls = message.tool_calls ?? []
  if (calls.length === 0) {
    return ""
  }

  return calls
    .map((call) => {
      return `tool_call(id: ${call.id}, name: ${call.function.name}, args: ${call.function.arguments})`
    })
    .join("\n")
}

function renderMessage(message: ChatMessage): string {
  if (message.role === "tool") {
    return `TOOL_RESULT (call_id: ${message.tool_call_id ?? "unknown"}): ${renderContent(message)}`
  }

  const content = renderContent(message)
  const toolCalls = renderToolCalls(message)
  const body = [content, toolCalls].filter((part) => part.length > 0).join("\n")
  return `${message.role.toUpperCase()}: ${body}`
}

export function buildPrompt(request: ChatCompletionRequest): string {
  const rendered = request.messages.map(renderMessage)
  const hasToolResults = request.messages.some((message) => message.role === "tool")
  if (!hasToolResults) {
    return rendered.join("\n\n")
  }

  return [
    ...rendered,
    "The above tool calls have been executed. Continue your response based on these results.",
  ].join("\n\n")
}
