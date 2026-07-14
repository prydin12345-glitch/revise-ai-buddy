/**
 * Quantitative subjects get the Working/Final-answer split and the maths
 * keypad. Everything else (English, History, RS, Geography prose, etc.)
 * gets a single, unified writing workspace — a 5-mark English question is
 * one continuous piece of writing, not "working" plus a one-line answer.
 */
export const isQuantitativeSubject = (s?: string | null): boolean =>
  /math|physic|chemist|engineer|electric|electronic|comput(er|ing)|statist|account|econom/i.test(s || "");
