import { describe, expect, it } from "vitest"
import {
  buildPrompt,
  type ChatCompletionRequest,
  convertCursorStreamJsonLine,
  createChatCompletionResponse,
} from "../src"

describe("OpenAI protocol helpers", () => {
  it("#given chat messages #when prompt is built #then roles and tool results are preserved", () => {
    // given
    const request: ChatCompletionRequest = {
      model: "cursor-acp/auto",
      messages: [
        { role: "system", content: "Be concise." },
        { role: "developer", content: "Prefer tool use when requested." },
        { role: "user", content: [{ type: "text", text: "Hello" }] },
        { role: "tool", tool_call_id: "call_1", content: "42" },
      ],
    }

    // when
    const prompt = buildPrompt(request)

    // then
    expect(prompt).toContain("SYSTEM: Be concise.")
    expect(prompt).toContain("DEVELOPER: Prefer tool use when requested.")
    expect(prompt).toContain("USER: Hello")
    expect(prompt).toContain("TOOL_RESULT (call_id: call_1): 42")
  })

  it("#given completion content #when response is created #then it matches OpenAI chat shape", () => {
    // given
    const content = "Bonjour"

    // when
    const response = createChatCompletionResponse({
      id: "chatcmpl_test",
      created: 1,
      model: "cursor-acp/auto",
      content,
    })

    // then
    expect(response.object).toBe("chat.completion")
    expect(response.choices[0].message.content).toBe(content)
  })

  it("#given accumulated cursor stream-json #when lines convert #then deltas are not duplicated", () => {
    // given
    const firstLine =
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi"}]}}'
    const secondLine =
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hi there"}]}}'

    // when
    const first = convertCursorStreamJsonLine({
      line: firstLine,
      previousText: "",
      previousReasoning: "",
      sawTextPartials: false,
      sawReasoningPartials: false,
    })
    const second = convertCursorStreamJsonLine({
      line: secondLine,
      previousText: first.text,
      previousReasoning: first.reasoning,
      sawTextPartials: first.sawTextPartials,
      sawReasoningPartials: first.sawReasoningPartials,
    })

    // then
    expect(first.event).toEqual({ type: "text", text: "Hi" })
    expect(second.event).toEqual({ type: "text", text: " there" })
  })

  it("#given cumulative cursor partials #when lines convert #then streamed deltas are not duplicated", () => {
    // given
    const firstLine =
      '{"type":"assistant","timestamp_ms":1,"message":{"role":"assistant","content":[{"type":"text","text":"I read"}]}}'
    const secondLine =
      '{"type":"assistant","timestamp_ms":2,"message":{"role":"assistant","content":[{"type":"text","text":"I read this"}]}}'
    const finalLine =
      '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"I read this"}]}}'

    // when
    const first = convertCursorStreamJsonLine({
      line: firstLine,
      previousText: "",
      previousReasoning: "",
      sawTextPartials: false,
      sawReasoningPartials: false,
    })
    const second = convertCursorStreamJsonLine({
      line: secondLine,
      previousText: first.text,
      previousReasoning: first.reasoning,
      sawTextPartials: first.sawTextPartials,
      sawReasoningPartials: first.sawReasoningPartials,
    })
    const final = convertCursorStreamJsonLine({
      line: finalLine,
      previousText: second.text,
      previousReasoning: second.reasoning,
      sawTextPartials: second.sawTextPartials,
      sawReasoningPartials: second.sawReasoningPartials,
    })

    // then
    expect(first.event).toEqual({ type: "text", text: "I read" })
    expect(second.event).toEqual({ type: "text", text: " this" })
    expect(final.event).toBeUndefined()
  })
})
