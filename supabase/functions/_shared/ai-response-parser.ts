// FILE: supabase/functions/_shared/ai-response-parser.ts
// AI response parsing, JSON recovery, question schemas, and the simplified
// retry prompt — extracted verbatim from generate-practice-questions
// (Phase 3 refactor). These are deterministic gates between what the AI
// returns and what the engine accepts.
import { z } from "https://esm.sh/zod@3.25.76";

export const QuestionTypeSchema = z.enum([
  'short_answer',
  'extended',
  'mcq',
  'table_grid',
  'graph_interpretation',
  'graph_plotting',
  'graph_transformation',
]);

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const PracticeQuestionSchema = z.object({
  question_number: z.string().min(1),
  question_text: z.string().min(1),
  question_latex: z.null().optional().nullable(),
  question_type: QuestionTypeSchema,
  marks: z.number().int().min(1).max(20),
  subtopic: z.string().min(1),
  difficulty_level: DifficultySchema,
  has_math: z.boolean().optional().default(false),
  equation_complexity: z.enum(['simple', 'medium', 'complex']).optional().nullable(),
  correct_answer: z.unknown(),
  options: z.array(z.string()).optional().nullable(),
  worked_solution: z.string().optional().nullable(),
  rationale: z.string().optional().nullable(),
  table_data: z.unknown().optional().nullable(),
  chart_data: z.unknown().optional().nullable(),
}).passthrough();

export const GeneratePracticeQuestionsSchema = z.object({
  questions: z.array(PracticeQuestionSchema).min(1),
});

export const isAsciiOnly = (s: string) => {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // allow tab/newline/carriage return
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c > 126) return false;
  }
  return true;
};

export const buildSimplifiedPrompt = (
  subject: string,
  topics: string,
  count: number,
  difficulty: string,
): string => `
Generate ${count} ${difficulty} practice questions for ${subject} on the topic: ${topics}.

Return a JSON array of question objects via the generate_practice_questions tool.
Each object must have:
- question_text: string
- question_type: "short_answer" | "long_form" | "mcq" | "extended"
- marks: number (1-6)
- correct_answer: string
- working_out: string (step by step solution)

For ${difficulty} difficulty:
${difficulty === 'hard'
  ? 'Questions must be multi-part, use real-world contexts, and be 4-6 marks each.'
  : difficulty === 'easy'
  ? 'Questions must be single-step recall or basic application, 1-2 marks each.'
  : 'Questions must be 2-4 step calculations or explanations, 2-4 marks each.'}

Return valid JSON via the tool only. No markdown, no code blocks, no preamble.
`.trim();

export const sanitizeJsonString = (raw: string): string => {
  // Replace invalid escape sequences inside strings.
  // Valid JSON escapes: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
  // Anything else (e.g. \s, \l, \q from LaTeX) is invalid.
  let result = '';
  let inString = false;
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === '"' && (i === 0 || raw[i - 1] !== '\\')) {
      inString = !inString;
      result += c;
      i++;
      continue;
    }
    if (inString && c === '\\') {
      const next = raw[i + 1];
      if (next === undefined) {
        // Trailing backslash - escape it
        result += '\\\\';
        i++;
        continue;
      }
      // Check for valid JSON escapes
      if ('"\\\/bfnrt'.includes(next)) {
        result += c + next;
        i += 2;
        continue;
      }
      if (next === 'u') {
        // Check for valid unicode escape \uXXXX
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          result += raw.slice(i, i + 6);
          i += 6;
          continue;
        }
      }
      // Invalid escape - double the backslash to make it literal
      result += '\\\\' + next;
      i += 2;
      continue;
    }
    result += c;
    i++;
  }
  return result;
};

export const extractToolArgs = (ai: any) => {
  // Gateway/provider-level errors come back in a different shape (no tool_calls).
  if (ai?.error) {
    const code = ai.error?.code;
    const message = ai.error?.message || 'Unknown AI provider error';
    const provider = ai.error?.metadata?.provider_name;
    const raw = ai.error?.metadata?.raw;
    const extra = [provider ? `provider=${provider}` : null, raw ? `raw=${raw}` : null].filter(Boolean).join(' ');
    throw new Error(`AI provider error${code ? ` (${code})` : ''}: ${message}${extra ? ` (${extra})` : ''}`);
  }

  const msg = ai?.choices?.[0]?.message;
  const toolCalls = msg?.tool_calls;
  const call = Array.isArray(toolCalls) ? toolCalls[0] : null;

  if (!call?.function?.arguments) {
    // Some models occasionally place JSON in message.content instead of tool_calls.
    const content = msg?.content;
    if (typeof content === 'string' && content.trim().length > 0) {
      const trimmed = content.trim();
      const jsonCandidate = trimmed.startsWith('{') ? trimmed : (trimmed.match(/\{[\s\S]*\}$/)?.[0] ?? null);
      if (jsonCandidate) {
        try {
          return JSON.parse(jsonCandidate);
        } catch {
          try {
            const sanitized = sanitizeJsonString(jsonCandidate);
            return JSON.parse(sanitized);
          } catch { /* fall through to array recovery */ }
        }
      }

      // Recovery: model returned a raw JSON array of questions instead of the tool envelope.
      const arrayMatch = trimmed.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try {
          const parsed = JSON.parse(sanitizeJsonString(arrayMatch[0]));
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`[Recovery] Extracted ${parsed.length} questions from plain text array`);
            return { questions: parsed };
          }
        } catch (e) {
          console.error('[Recovery] Failed to parse plain text JSON array:', e);
        }
      }

      // Last-ditch: pull individual question objects.
      const objectMatches = [...trimmed.matchAll(/\{[^{}]*"question_text"[\s\S]*?\}(?=\s*[,\]\}]|\s*$)/g)];
      if (objectMatches.length > 0) {
        const recovered: any[] = [];
        for (const m of objectMatches) {
          try { recovered.push(JSON.parse(sanitizeJsonString(m[0]))); } catch { /* skip */ }
        }
        if (recovered.length > 0) {
          console.log(`[Recovery] Extracted ${recovered.length} individual questions from plain text`);
          return { questions: recovered };
        }
      }
    }

    console.error('Unexpected AI response shape (missing tool_calls):', JSON.stringify(ai).slice(0, 2000));
    throw new Error('AI response missing tool output');
  }

  let argsText = String(call.function.arguments);
  
  // Attempt parse; if fails, sanitize and retry once
  try {
    return JSON.parse(argsText);
  } catch (firstErr) {
    console.warn('First JSON.parse failed, sanitizing:', (firstErr as Error).message);
    const sanitized = sanitizeJsonString(argsText);
    try {
      return JSON.parse(sanitized);
    } catch (secondErr) {
      // Log context around failure position
      const match = (secondErr as Error).message.match(/position (\d+)/);
      const pos = match ? parseInt(match[1], 10) : 0;
      const snippet = sanitized.slice(Math.max(0, pos - 50), pos + 50);
      console.error('Sanitized JSON still invalid. Context:', snippet);
      throw new Error(`Failed to parse AI tool arguments: ${(secondErr as Error).message}`);
    }
  }
};
