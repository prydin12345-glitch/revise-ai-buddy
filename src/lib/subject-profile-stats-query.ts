import type { WorkspaceStore } from "@/hooks/use-workspace-session";
import { workspaceUser } from "./workspace-query-client";
import { startOfWeek } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { readStatsPages, SUBMITTED_STATUSES, type SubmissionRow } from './dashboard-stats-data';
import { buildScoreData, type QuizAnswerRow, type QuizProgressRow, type QuizQuestionRow, type ScoreProfileRow } from './dashboard-scores';
import { statsSubjectKey, validStatsDate, validStatsMark, type StatsProfile, type StatsStudyRecord, type StatsSubject, type StatsTopicAnswer, type StatsWrongQuestion, type SubjectProfileStatsData } from './subject-profile-stats';

interface SubjectRow { id: string; subject_name: string; subject_color: string; exam_board: string | null }
interface ProfileRow extends ScoreProfileRow { exam_board?: string | null; educational_tier?: string | null; assessment_tier?: string | null }
interface ProgressRow extends QuizProgressRow { time_spent_seconds?: number | null }
interface ExamQuestionRow { id: string; exam_id: string; question_number: string; marks: number; topic_tag: string | null }
interface ExamAnswerRow { id: string; exam_id: string; question_id: string; score: number | null; submitted_at: string | null }
interface PracticeQuestionRow extends QuizQuestionRow { subtopic: string | null }
interface TaskRow { id: string; subject: string; duration: number | null; date: string; is_completed?: boolean | null }
interface GoalRow { subject: string; target_percentage: number | null; deadline: string | null }
interface AliasRow { alias: string; canonical_topic: string; subject: string | null }
interface StreakRow { current_streak: number | null; longest_streak: number | null; last_exam_submitted_at: string | null }

/** Owner-scoped, bounded metadata reads. Assessment text, private keys and answers are never selected. */
export async function loadSubjectProfileStats(userId: string, signal: AbortSignal, now = new Date()): Promise<SubjectProfileStatsData> {
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const [submissions, progress, savedProfiles, savedSubjects, tasks, goals, streakResult] = await Promise.all([
    readStatsPages<SubmissionRow>((from, to) => supabase.from('exam_submission_metadata')
      .select('id, exam_id, total_score, total_marks, submitted_at, status, time_taken_seconds, exams(title, subject_id, grade_released, profile_id)')
      .eq('student_id', userId).in('status', SUBMITTED_STATUSES).order('submitted_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<ProgressRow>((from, to) => supabase.from('practice_set_progress')
      .select('id, set_id, completed_at, time_spent_seconds, practice_question_sets!inner(id, set_name, subject_id, profile_id, total_questions_generated)')
      .eq('user_id', userId).eq('practice_question_sets.user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<ProfileRow>((from, to) => supabase.from('subject_exam_profiles')
      .select('id, profile_name, subject_name, exam_board, educational_tier, assessment_tier').eq('user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<SubjectRow>((from, to) => supabase.from('user_subjects')
      .select('id, subject_name, subject_color, exam_board').eq('user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<TaskRow>((from, to) => supabase.from('revision_tasks').select('id, subject, duration, date, is_completed').eq('user_id', userId)
      .eq('is_completed', true).gte('date', weekStart).lte('date', now.toISOString()).order('id').range(from, to).abortSignal(signal), signal),
    readStatsPages<GoalRow>((from, to) => supabase.from('revision_goals').select('subject, target_percentage, deadline')
      .eq('user_id', userId).order('id').range(from, to).abortSignal(signal), signal),
    supabase.from('user_streaks').select('current_streak, longest_streak, last_exam_submitted_at').eq('user_id', userId).abortSignal(signal).maybeSingle(),
  ]);
  if (streakResult.error) throw new Error('Couldn’t load your activity. Please try again.');
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const seenExams = new Set<string>();
  const latestSubmissions = submissions.filter(row => { if (!row.exam_id || seenExams.has(row.exam_id)) return false; seenExams.add(row.exam_id); return true; });
  // These totals come from the security-barrier view, which already applies
  // can_read_exam_solutions (including owner and assignment-specific release).
  // The paper-wide grade_released flag is not the current user's release grant.
  const exams = latestSubmissions.filter(row => row.exam_id && row.exams && validStatsDate(row.submitted_at, now)).map(row => {
    const released = row.status === 'graded' && validStatsMark(row.total_score, row.total_marks);
    return { id: row.exam_id!, title: row.exams!.title, subject: row.exams!.subject_id,
      profileId: row.exams!.profile_id || null, dateTaken: row.submitted_at!, status: row.status || undefined,
      isReleased: released, score: released ? row.total_score! / row.total_marks! * 100 : 0,
      earnedMarks: released ? row.total_score! : 0, totalMarks: released ? row.total_marks! : 0 };
  });
  const releasedIds = [...new Set(exams.filter(exam => exam.isReleased && validStatsDate(exam.dateTaken, now)).map(exam => exam.id))];
  const examQuestions: ExamQuestionRow[] = [], examAnswers: ExamAnswerRow[] = [];
  for (let offset = 0; offset < releasedIds.length; offset += 100) {
    const ids = releasedIds.slice(offset, offset + 100);
    const [parts, answers] = await Promise.all([
      readStatsPages<ExamQuestionRow>((from, to) => supabase.from('exam_questions').select('id, exam_id, question_number, marks, topic_tag')
        .in('exam_id', ids).order('id').range(from, to).abortSignal(signal), signal),
      readStatsPages<ExamAnswerRow>((from, to) => supabase.from('student_answers').select('id, exam_id, question_id, score, submitted_at')
        .eq('student_id', userId).in('exam_id', ids).order('submitted_at', { ascending: false }).order('id').range(from, to).abortSignal(signal), signal),
    ]);
    examQuestions.push(...parts); examAnswers.push(...answers);
    if (examQuestions.length > 20_000 || examAnswers.length > 20_000) throw new Error('There’s too much exam history to load at once.');
  }
  // Some historic assignment policies permit the metadata view but not raw
  // topic rows. Preserve question review from public IDs/marks and explicitly
  // mark topic results unavailable instead of inventing an empty/zero result.
  const missingTopicExams = exams.filter(exam => exam.isReleased && !examQuestions.some(question => question.exam_id === exam.id));
  for (let offset = 0; offset < missingTopicExams.length; offset += 100) {
    const ids = missingTopicExams.slice(offset, offset + 100).map(exam => exam.id);
    const metadata = await readStatsPages<Omit<ExamQuestionRow, 'topic_tag'>>((from, to) => supabase.from('exam_question_metadata')
      .select('id, exam_id, question_number, marks').in('exam_id', ids).order('id').range(from, to).abortSignal(signal), signal);
    examQuestions.push(...metadata.map(question => ({ ...question, topic_tag: null })));
    if (examQuestions.length > 20_000) throw new Error('There’s too much exam history to load at once.');
  }
  const setIds = [...new Set(progress.filter(row => row.practice_question_sets?.id === row.set_id).map(row => row.set_id))];
  const practiceQuestions: PracticeQuestionRow[] = [], practiceAnswers: QuizAnswerRow[] = [];
  for (let offset = 0; offset < setIds.length; offset += 100) {
    const ids = setIds.slice(offset, offset + 100);
    const [parts, answers] = await Promise.all([
      readStatsPages<PracticeQuestionRow>((from, to) => supabase.from('practice_questions').select('id, set_id, marks, subtopic')
        .in('set_id', ids).order('id').range(from, to).abortSignal(signal), signal),
      readStatsPages<QuizAnswerRow>((from, to) => supabase.from('practice_question_answers').select('id, set_id, question_id, score, submitted_at, updated_at')
        .eq('user_id', userId).in('set_id', ids).order('id').range(from, to).abortSignal(signal), signal),
    ]);
    practiceQuestions.push(...parts); practiceAnswers.push(...answers);
    if (practiceQuestions.length > 20_000 || practiceAnswers.length > 20_000) throw new Error('There’s too much practice history to load at once.');
  }
  const safePracticeAnswers = practiceAnswers.map(answer => answer.updated_at && !validStatsDate(answer.updated_at, now) ? { ...answer, score: null } : answer);
  const scoreData = buildScoreData(exams, progress, practiceQuestions, safePracticeAnswers, savedProfiles, savedSubjects.map(row => row.subject_name), now);
  const profiles: StatsProfile[] = savedProfiles.map(row => ({ id: row.id, name: row.profile_name, subject: row.subject_name, examBoard: row.exam_board, educationLevel: row.educational_tier, assessmentTier: row.assessment_tier }));
  const subjects: StatsSubject[] = savedSubjects.map(row => {
    const levels = [...new Set(profiles.filter(profile => statsSubjectKey(profile.subject) === statsSubjectKey(row.subject_name)).map(profile => profile.educationLevel).filter((level): level is string => !!level))];
    return { id: row.id, name: row.subject_name, color: row.subject_color, examBoard: row.exam_board, educationLevel: levels.length === 1 ? levels[0] : null };
  });
  const historySubjects = [...scoreData.subjects, ...progress.map(row => row.practice_question_sets?.subject_id).filter((name): name is string => !!name)];
  for (const name of historySubjects) if (!subjects.some(subject => statsSubjectKey(subject.name) === statsSubjectKey(name))) subjects.push({ id: `history:${statsSubjectKey(name)}`, name, color: '#3b82f6' });
  subjects.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const examMap = new Map(exams.filter(exam => exam.isReleased).map(exam => [exam.id, exam]));
  const setMap = new Map(progress.filter(row => row.practice_question_sets?.id === row.set_id).map(row => [row.set_id, row.practice_question_sets!]));
  const profileNames = new Map(profiles.map(profile => [profile.id, profile]));
  const profileName = (id: string | null, subject: string) => !id ? 'No profile' : statsSubjectKey(profileNames.get(id)?.subject || '') === statsSubjectKey(subject) ? profileNames.get(id)!.name : 'Saved profile';
  // The global alias catalogue contains topic names only; it is not an assessment key.
  let aliases: AliasRow[] = [];
  if (examQuestions.some(question => question.topic_tag)) {
    aliases = await readStatsPages<AliasRow>((from, to) => supabase.from('topic_aliases' as never).select('alias, canonical_topic, subject').order('alias').order('subject', { nullsFirst: true }).range(from, to).abortSignal(signal) as unknown as PromiseLike<{ data: AliasRow[] | null; error: unknown }>, signal);
  }
  const aliasMap = new Map(aliases.map(row => [`${row.subject ? statsSubjectKey(row.subject) : ''}:${statsSubjectKey(row.alias)}`, row.canonical_topic]));
  const canonical = (topic: string, subject: string) => aliasMap.get(`${statsSubjectKey(subject)}:${statsSubjectKey(topic)}`) || aliasMap.get(`:${statsSubjectKey(topic)}`) || topic.trim();
  const questionMap = new Map(examQuestions.map(question => [question.id, question]));
  const latestExamAnswers = new Map<string, ExamAnswerRow>();
  for (const answer of examAnswers) {
    const key = `${answer.exam_id}:${answer.question_id}`, previous = latestExamAnswers.get(key);
    if (!previous || (answer.submitted_at || '') > (previous.submitted_at || '') || (answer.submitted_at === previous.submitted_at && answer.id > previous.id)) latestExamAnswers.set(key, answer);
  }
  const topicAnswers: StatsTopicAnswer[] = [], wrongQuestions: StatsWrongQuestion[] = [];
  for (const answer of latestExamAnswers.values()) {
    const question = questionMap.get(answer.question_id), exam = examMap.get(answer.exam_id);
    if (!question || !exam || question.exam_id !== exam.id || !validStatsDate(exam.dateTaken, now) || (answer.submitted_at && !validStatsDate(answer.submitted_at, now))) continue;
    const topic = question.topic_tag ? canonical(question.topic_tag, exam.subject) : '';
    const date = validStatsDate(answer.submitted_at, now) ? answer.submitted_at : exam.dateTaken;
    if (topic && Number.isFinite(question.marks) && question.marks > 0) topicAnswers.push({ source: 'exam', subject: exam.subject, profileId: exam.profileId || null, topic, questionId: question.id, parentId: exam.id, date, score: validStatsMark(answer.score, question.marks) ? answer.score : null, marks: question.marks });
    if (validStatsMark(answer.score, question.marks) && answer.score < question.marks) wrongQuestions.push({ examId: exam.id, questionId: question.id, profileId: exam.profileId || null, subject: exam.subject, topic: topic || `Question ${question.question_number}`, questionNumber: question.question_number, score: answer.score, marks: question.marks, date, examTitle: exam.title, profileName: profileName(exam.profileId || null, exam.subject) });
  }
  const practiceQuestionMap = new Map(practiceQuestions.map(question => [question.id, question]));
  const latestPractice = new Map<string, QuizAnswerRow>();
  for (const answer of safePracticeAnswers) {
    const key = `${answer.set_id}:${answer.question_id}`, previous = latestPractice.get(key);
    if (!previous || (answer.updated_at || answer.submitted_at || '') > (previous.updated_at || previous.submitted_at || '')) latestPractice.set(key, answer);
  }
  for (const answer of latestPractice.values()) {
    const question = practiceQuestionMap.get(answer.question_id), set = setMap.get(answer.set_id);
    if (!question || !set || question.set_id !== set.id || !question.subtopic || !Number.isFinite(question.marks) || question.marks <= 0 || (answer.submitted_at && !validStatsDate(answer.submitted_at, now))) continue;
    topicAnswers.push({ source: 'quiz', subject: set.subject_id, profileId: set.profile_id, topic: canonical(question.subtopic, set.subject_id), questionId: question.id, parentId: set.id, date: answer.submitted_at, score: validStatsDate(answer.submitted_at, now) && validStatsMark(answer.score, question.marks) ? answer.score : null, marks: question.marks });
  }
  const examIdentity = new Map(exams.map(exam => [exam.id, exam]));
  const pending = scoreData.pending.map(row => ({ ...row, profileId: row.source === 'exam' ? examIdentity.get(row.id)?.profileId || null : setMap.get(row.id)?.profile_id || null }));
  const study: StatsStudyRecord[] = [];
  const seenStudy = new Set<string>();
  for (const row of latestSubmissions) {
    if (!row.exam_id || !row.exams || !validStatsDate(row.submitted_at, now) || seenStudy.has(`exam:${row.exam_id}`) || typeof row.time_taken_seconds !== 'number' || !Number.isFinite(row.time_taken_seconds) || row.time_taken_seconds <= 0) continue;
    seenStudy.add(`exam:${row.exam_id}`);
    study.push({ source: 'exam', subject: row.exams.subject_id, profileId: row.exams.profile_id || null, date: row.submitted_at, hours: row.time_taken_seconds / 3600 });
  }
  for (const row of progress) {
    const set = row.practice_question_sets;
    if (!set || set.id !== row.set_id || !validStatsDate(row.completed_at, now) || seenStudy.has(`quiz:${row.set_id}`) || typeof row.time_spent_seconds !== 'number' || !Number.isFinite(row.time_spent_seconds) || row.time_spent_seconds <= 0) continue;
    seenStudy.add(`quiz:${row.set_id}`);
    study.push({ source: 'quiz', subject: set.subject_id, profileId: set.profile_id, date: row.completed_at, hours: row.time_spent_seconds / 3600 });
  }
  for (const row of tasks) if (row.is_completed === true && validStatsDate(row.date, now) && typeof row.duration === 'number' && Number.isFinite(row.duration) && row.duration > 0) study.push({ source: 'revision', subject: row.subject, profileId: null, date: row.date, hours: row.duration / 60 });
  const streak = streakResult.data as StreakRow | null;
  const currentStreak = streak?.last_exam_submitted_at && validStatsDate(streak.last_exam_submitted_at, now) && now.getTime() - Date.parse(streak.last_exam_submitted_at) <= 86_400_000 ? Math.max(0, streak.current_streak || 0) : 0;
  return { subjects, profiles, unavailableExamCount: latestSubmissions.filter(row => !row.exams).length, topicUnavailableExams: missingTopicExams.map(exam => ({ examId: exam.id, subject: exam.subject, profileId: exam.profileId })), attempts: scoreData.attempts, pending, topicAnswers, study, wrongQuestions, revisionGoals: goals.filter(row => typeof row.target_percentage === 'number' && Number.isFinite(row.target_percentage) && row.target_percentage >= 0 && row.target_percentage <= 100).map(row => ({ subject: row.subject, targetPercentage: row.target_percentage!, deadline: row.deadline })), currentStreak, longestStreak: Math.max(0, streak?.longest_streak || 0) };
}

/** Shared by route preparation and the page, so navigation warms the same safe cache. */
export function subjectProfileStatsQuery(store: WorkspaceStore) {
  return {
    queryKey: ['workspace-subject-profile-stats:v1', store.ownerId] as const,
    queryFn: async (context: { signal?: AbortSignal } = {}) => {
      const user = await workspaceUser(store);
      if (!user) throw new Error('Sign in to view your statistics.');
      const controller = new AbortController();
      const abort = () => controller.abort();
      context.signal?.addEventListener('abort', abort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
      try {
        if (context.signal?.aborted) controller.abort();
        return await loadSubjectProfileStats(user.id, controller.signal);
      } catch (error) {
        if (timedOut) throw new Error('Your statistics took too long to load. Please retry.');
        throw error;
      } finally {
        clearTimeout(timer);
        context.signal?.removeEventListener('abort', abort);
      }
    },
  };
}
