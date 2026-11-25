import { readLimitedBody } from "../_shared/profile-document-io.ts";
import { SourceCallUncertainError } from "../_shared/profile-builder-diagnostics.ts";

const MAX_JSON_BYTES = 250_000;
const MAX_EVENT_BYTES = 2_500_000;

type Usage = { prompt_tokens?: unknown; completion_tokens?: unknown };
type Completion = {
  error?: unknown;
  usage?: Usage | null;
  choices?: Array<{
    index?: number;
    finish_reason?: string | null;
    message?: { content?: string | null };
    delta?: { content?: string | null };
  }>;
};

function eventCompletion(text: string) {
  const fragments: string[] = [];
  let usage: Usage | undefined;
  let finish: string | null | undefined;
  let done = false;
  for (const event of text.split(/\r?\n\r?\n/)) {
    const data = event.split(/\r?\n/)
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trimStart())
      .join("\n");
    if (!data) continue;
    if (data.trim() === "[DONE]") {
      done = true;
      break;
    }
    const chunk = JSON.parse(data) as Completion;
    if (chunk.error) throw new SourceCallUncertainError("interrupted");
    if (chunk.usage) usage = chunk.usage;
    const choice = chunk.choices?.find(choice => (choice.index ?? 0) === 0);
    if (typeof choice?.delta?.content === "string") fragments.push(choice.delta.content);
    if (choice?.finish_reason) finish = choice.finish_reason;
  }
  // An interrupted stream can contain syntactically valid JSON. Only use it
  // after the provider has marked the completion finished.
  if (!done && !finish) throw new SourceCallUncertainError("interrupted");
  return { content: fragments.join(""), finish, usage };
}

export async function readBuilderCompletion(response: Response, remainingMs: number) {
  const events = /^text\/event-stream\b/i.test(response.headers.get("Content-Type") ?? "");
  const body = new TextDecoder().decode(await readLimitedBody(
    response.body,
    events ? MAX_EVENT_BYTES : MAX_JSON_BYTES,
    Math.max(1, remainingMs),
  ));
  const completion = events ? eventCompletion(body) : (() => {
    const json = JSON.parse(body) as Completion;
    if (json.error || !Array.isArray(json.choices))
      throw new SourceCallUncertainError("interrupted");
    return { content: json.choices[0]?.message?.content, finish: json.choices[0]?.finish_reason, usage: json.usage };
  })();
  let value: unknown = { invalidOutput: true };
  if (typeof completion.content === "string" &&
      new TextEncoder().encode(completion.content).length <= MAX_JSON_BYTES &&
      (!completion.finish || completion.finish === "stop")) {
    try {
      value = JSON.parse(completion.content);
    } catch {
      // A completed but invalid reply can use the existing bounded repair.
    }
  }
  const tokens = (value: unknown) => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 && n <= 10_000_000 ? n : 0;
  };
  return {
    value,
    promptTokens: tokens(completion.usage?.prompt_tokens),
    completionTokens: tokens(completion.usage?.completion_tokens),
  };
}
