import { endOfYear, startOfYear } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { parseDay } from './dashboard-stats';
import { examItems, readStatsPages, SUBMITTED_STATUSES, type SubmissionRow } from './dashboard-stats-data';
import { buildScoreData, type QuizAnswerRow, type QuizProgressRow, type QuizQuestionRow, type ScoreProfileRow } from './dashboard-scores';

/** Fetch one year for fast day/month switching; no solutions or answer text are selected. */
export async function loadDashboardScores(userId: string, year: string, signal: AbortSignal, now = new Date()) {
  const date = parseDay(`${year}-01-01`);
  if (date > now) throw new Error('Choose today or an earlier date.');
  const start = startOfYear(date).toISOString();
  const end = new Date(Math.min(endOfYear(date).getTime(), now.getTime())).toISOString();
  const [submissions, progress, profiles, subjects] = await Promise.all([
    readStatsPages<SubmissionRow>((from, to) => supabase.from('exam_submission_metadata')
      .select('id, exam_id, total_score, total_marks, submitted_at, status, exams!inner(title, subject_id, grade_released, profile_id)')
      .eq('student_id', userId).in('status', SUBMITTED_STATUSES).gte('submitted_at', start).lte('submitted_at', end)
      .order('submitted_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<QuizProgressRow>((from, to) => supabase.from('practice_set_progress')
      .select('id, set_id, completed_at, practice_question_sets!inner(id, set_name, subject_id, profile_id, total_questions_generated)')
      .eq('user_id', userId).eq('practice_question_sets.user_id', userId).not('completed_at', 'is', null)
      .gte('completed_at', start).lte('completed_at', end).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<ScoreProfileRow>((from, to) => supabase.from('subject_exam_profiles')
      .select('id, profile_name, subject_name').eq('user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<{ subject_name: string }>((from, to) => supabase.from('user_subjects')
      .select('subject_name').eq('user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
  ]);
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const setIds = [...new Set(progress.filter(row => row.set_id && row.practice_question_sets?.id === row.set_id).map(row => row.set_id))];
  const questions: QuizQuestionRow[] = [];
  const answers: QuizAnswerRow[] = [];
  // Bound PostgREST URL length. Parent IDs come only from the owner's completed sets.
  for (let offset = 0; offset < setIds.length; offset += 100) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const ids = setIds.slice(offset, offset + 100);
    const [parts, marks] = await Promise.all([
      readStatsPages<QuizQuestionRow>((from, to) => supabase.from('practice_questions')
        .select('id, set_id, marks').in('set_id', ids).order('id').range(from, to).abortSignal(signal), signal),
      readStatsPages<QuizAnswerRow>((from, to) => supabase.from('practice_question_answers')
        .select('id, set_id, question_id, score, submitted_at, updated_at').eq('user_id', userId)
        .in('set_id', ids).order('id').range(from, to).abortSignal(signal), signal),
    ]);
    questions.push(...parts); answers.push(...marks);
    if (questions.length > 20_000 || answers.length > 20_000) throw new Error('There’s too much quiz history in this year to load at once.');
  }
  const exams = examItems(submissions);
  return { exams, scores: buildScoreData(exams, progress, questions, answers, profiles, subjects.map(subject => subject.subject_name), now) };
}
