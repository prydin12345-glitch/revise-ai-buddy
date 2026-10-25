import type { ResponseQuestionView } from "./response-view";

/** Authorised review data stays in the open dialog; never put it in Stats metadata/cache. */
export interface ReleasedRevisitQuestion extends ResponseQuestionView {
  id: string;
  exam_id?: string;
  question_number: string;
  question_text: string;
  question_type?: string;
  marks: number;
  correct_answer?: unknown;
  options?: unknown;
  has_math?: boolean;
  question_latex?: string;
  diagram_config?: unknown;
  subject?: string;
  topic_tag?: string;
}
export interface ReleasedRevisitAnswer {
  question_id: string;
  answer_text?: string | null;
  score: number;
}
export interface ReleasedRevisit {
  question: ReleasedRevisitQuestion;
  answer: ReleasedRevisitAnswer;
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);

/** Recheck the live server response; a previously eligible list row is not a release grant. */
export function readReleasedRevisit(payload: unknown, examId: string, questionId: string): ReleasedRevisit {
  if (!object(payload) || payload.scoresHidden !== false || !object(payload.submission) || payload.submission.status !== "graded") {
    throw new Error("This marked review is not released yet. Expected answers remain unavailable.");
  }
  const question = Array.isArray(payload.questions) ? payload.questions.find(row => object(row) && row.id === questionId) : undefined;
  const answer = Array.isArray(payload.existingAnswers) ? payload.existingAnswers.find(row => object(row) && row.question_id === questionId) : undefined;
  if (!object(question) || !object(answer) || (question.exam_id !== undefined && question.exam_id !== examId) ||
      typeof question.question_text !== "string" || typeof question.question_number !== "string" ||
      typeof question.marks !== "number" || !Number.isFinite(question.marks) || question.marks <= 0 ||
      typeof answer.score !== "number" || !Number.isFinite(answer.score) || answer.score < 0 || answer.score >= question.marks) {
    throw new Error("This question is no longer available in your questions to revisit. Open the exam review to check its latest result.");
  }
  return { question: question as unknown as ReleasedRevisitQuestion, answer: answer as unknown as ReleasedRevisitAnswer };
}

/** Resolve a legacy MCQ key to the same option text used by the saved question. */
export function legacyExpectedAnswer(question: ReleasedRevisitQuestion): unknown {
  const raw = question.correct_answer;
  if (typeof raw !== "string") return raw;
  const trimmed = raw.trim();
  if (/^[A-Za-z]$/.test(trimmed) && Array.isArray(question.options)) {
    const option = question.options[trimmed.toUpperCase().charCodeAt(0) - 65];
    const text = typeof option === "string" ? option : object(option) && typeof option.text === "string" ? option.text : null;
    if (text) return text.replace(/^[A-Za-z][.)]\s*/, "");
  }
  try { return JSON.parse(trimmed); } catch { return raw; }
}
