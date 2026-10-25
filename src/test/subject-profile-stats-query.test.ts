import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSubjectProfileStats, subjectProfileStatsQuery } from '@/lib/subject-profile-stats-query';
import { WorkspaceStore } from '@/hooks/use-workspace-session';
import { workspaceQueryClient } from '@/lib/workspace-query-client';
import { selectSubjectProfileStats } from '@/lib/subject-profile-stats';
const state = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, failed: '', authOwner: 'owner', calls: [] as { table: string; steps: unknown[][] }[] }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: async () => ({ data: { user: { id: state.authOwner } }, error: null }) }, from(table: string) {
  const call = { table, steps: [] as unknown[][] }; state.calls.push(call); const q: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'order', 'range', 'abortSignal', 'maybeSingle']) q[method] = (...args: unknown[]) => { call.steps.push([method, ...args]); return q; };
  q.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    let rows = [...(state.rows[table] || [])];
    for (const [method, column, value] of call.steps) {
      if (method === 'eq' && typeof column === 'string' && !column.includes('.')) rows = rows.filter(row => row[column] === value);
      if (method === 'in' && typeof column === 'string') rows = rows.filter(row => (value as unknown[]).includes(row[column]));
      if (method === 'range') rows = rows.slice(Number(column), Number(value) + 1);
    }
    const data = call.steps.some(step => step[0] === 'maybeSingle') ? rows[0] || null : rows;
    return Promise.resolve({ data, error: state.failed === table ? new Error('Fixture failure') : null }).then(resolve, reject);
  }; return q;
} } }));
const now = new Date('2026-10-24T12:00:00Z'), date = '2026-10-23T10:00:00Z';
const submission = (id: string, release: boolean, status = 'graded') => ({ id: 'sub-' + id, exam_id: id, student_id: 'owner', submitted_at: date, total_score: release ? 5 : null, total_marks: release ? 10 : null, status, time_taken_seconds: 3600, exams: { title: id, subject_id: 'Biology', profile_id: 'full', grade_released: release } });
beforeEach(() => { state.authOwner = 'owner'; state.failed = ''; state.calls = []; state.rows = {
  exam_submission_metadata: [submission('released', true), submission('locked', false), submission('pending', true, 'marking_failed')],
  user_subjects: [{ id: 'subject-id', subject_name: 'Biology', subject_color: '#123456', exam_board: 'OCR', user_id: 'owner' }],
  subject_exam_profiles: [{ id: 'full', profile_name: 'Paper 1', subject_name: 'Biology', educational_tier: 'alevel', exam_board: 'OCR', assessment_tier: 'not_tiered', user_id: 'owner' }],
  exam_questions: [{ id: 'q1', exam_id: 'released', question_number: '2(b)', marks: 4, topic_tag: 'cell alias' }, { id: 'q2', exam_id: 'released', question_number: '3', marks: 3, topic_tag: 'Cells' }, { id: 'secret-q', exam_id: 'locked', question_number: '1', marks: 5, topic_tag: 'Private' }],
  student_answers: [{ id: 'a1', student_id: 'owner', exam_id: 'released', question_id: 'q1', score: 0, submitted_at: date }, { id: 'a2', student_id: 'owner', exam_id: 'released', question_id: 'q2', score: null, submitted_at: date }, { id: 'private', student_id: 'owner', exam_id: 'locked', question_id: 'secret-q', score: 0, submitted_at: date }, { id: 'another', student_id: 'another-owner', exam_id: 'released', question_id: 'q1', score: 4, submitted_at: date }],
  practice_set_progress: [{ id: 'progress', set_id: 'set', user_id: 'owner', completed_at: date, time_spent_seconds: 1800, practice_question_sets: { id: 'set', subject_id: 'Biology', set_name: 'Quiz', profile_id: 'full', total_questions_generated: 2 } }],
  practice_questions: [{ id: 'pq1', set_id: 'set', subtopic: 'Cells', marks: 2 }, { id: 'pq2', set_id: 'set', subtopic: 'Cells', marks: 2 }],
  practice_question_answers: [{ id: 'pa1', user_id: 'owner', set_id: 'set', question_id: 'pq1', score: 2, submitted_at: date }, { id: 'pa2', user_id: 'owner', set_id: 'set', question_id: 'pq2', score: null, submitted_at: date }],
  topic_aliases: [{ alias: 'cell alias', canonical_topic: 'Cells' }],
  revision_tasks: [{ id: 'task', subject: 'Biology', user_id: 'owner', date, duration: 60, is_completed: true }],
  revision_goals: [{ user_id: 'owner', subject: 'Biology', target_percentage: 80, deadline: null }],
  user_streaks: [{ user_id: 'owner', current_streak: 3, longest_streak: 5, last_exam_submitted_at: date }],
}; });

describe('profile-aware Stats metadata loader', () => {
  it('loads only released valid exam question metadata and never selects private answer material', async () => {
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.subjects[0]).toMatchObject({ id: 'subject-id', educationLevel: 'alevel' });
    expect(data.attempts).toHaveLength(1); expect(data.pending).toHaveLength(3); // Locked, marking failure and incomplete quiz.
    expect(data.wrongQuestions).toHaveLength(1); expect(data.wrongQuestions[0]).toMatchObject({ questionId: 'q1', score: 0, topic: 'Cells', profileId: 'full', profileName: 'Paper 1' });
    expect(data.topicAnswers.some(row => row.topic === 'Private')).toBe(false);
    for (const call of state.calls) for (const step of call.steps.filter(step => step[0] === 'select')) expect(String(step[1])).not.toMatch(/correct_answer|response_key|question_text|answer_text|marking_scheme/);
    for (const call of state.calls.filter(call => call.table === 'exam_questions' || call.table === 'student_answers')) expect(call.steps).toContainEqual(['in', 'exam_id', ['released']]);
    const selected = selectSubjectProfileStats(data, { subjectId: 'subject-id' }, now);
    expect(selected.topics[0]).toMatchObject({ examScore: 0, practiceScore: 100, unifiedScore: 40, pendingQuestionCount: 2 });
    expect(selected.unassignedStudyHours).toBe(1); expect(selected.targetPercentage).toBe(80);
  });
  it.each(['exam_submission_metadata', 'practice_set_progress', 'subject_exam_profiles', 'user_subjects', 'revision_tasks', 'revision_goals', 'user_streaks', 'exam_questions', 'student_answers', 'practice_questions', 'practice_question_answers', 'topic_aliases'])('surfaces %s failure instead of returning a healthy empty view', async table => {
    state.failed = table;
    await expect(loadSubjectProfileStats('owner', new AbortController().signal, now)).rejects.toThrow(/load|activity/);
  });
  it('excludes failed, unsubmitted and invalid question marks from mistakes while preserving a true zero', async () => {
    state.rows.student_answers.push({ id: 'newer-null', student_id: 'owner', exam_id: 'released', question_id: 'q1', score: null, submitted_at: '2026-10-23T11:00:00Z' });
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.wrongQuestions).toEqual([]); expect(data.topicAnswers.find(row => row.questionId === 'q1')?.score).toBeNull();
  });
  it('resolves a subject-specific alias before a global fallback without merging another subject’s alias', async () => {
    state.rows.topic_aliases = [
      { alias: 'cell alias', canonical_topic: 'Biology cells', subject: 'Biology' },
      { alias: 'cell alias', canonical_topic: 'Global cells', subject: null },
      { alias: 'cell alias', canonical_topic: 'Chemistry atoms', subject: 'Chemistry' },
    ];
    let data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.topicAnswers.find(row => row.questionId === 'q1')?.topic).toBe('Biology cells');
    state.rows.topic_aliases.shift();
    data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.topicAnswers.find(row => row.questionId === 'q1')?.topic).toBe('Global cells');
    state.rows.topic_aliases = [{ alias: 'cell alias', canonical_topic: 'Chemistry atoms', subject: 'Chemistry' }];
    data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.topicAnswers.find(row => row.questionId === 'q1')?.topic).toBe('cell alias');
  });
  it('does not reuse an older released submission after a newer marking failure', async () => {
    state.rows.exam_submission_metadata.unshift({ ...submission('released', true, 'marking_failed'), submitted_at: '2026-10-24T10:00:00Z' });
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.attempts).toEqual([]); expect(data.wrongQuestions).toEqual([]);
    expect(data.topicAnswers.filter(row => row.source === 'exam')).toEqual([]);
    expect(state.calls.filter(call => call.table === 'exam_questions')).toHaveLength(0);
  });
  it('honours cancellation and does not read rows for another account', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(loadSubjectProfileStats('owner', controller.signal, now)).rejects.toMatchObject({ name: 'AbortError' });
    const data = await loadSubjectProfileStats('another-owner', new AbortController().signal, now);
    expect(data.attempts).toEqual([]); expect(data.wrongQuestions).toEqual([]); expect(data.topicAnswers).toEqual([]);
  });
  it('trusts authorised metadata totals for owner or assignment release even when the paper-wide flag is false', async () => {
    state.rows.exam_submission_metadata[0] = { ...submission('released', true), exams: { ...(submission('released', true).exams), grade_released: false } };
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.attempts.find(row => row.id === 'released')?.score).toBe(50);
    expect(data.wrongQuestions.find(row => row.questionId === 'q1')?.score).toBe(0);
    expect(data.pending.some(row => row.id === 'locked')).toBe(true);
  });
  it('keeps authorised question review available while explicitly flagging missing raw topic access', async () => {
    state.rows.exam_question_metadata = state.rows.exam_questions.map(({ id, exam_id, question_number, marks }) => ({ id, exam_id, question_number, marks }));
    state.rows.exam_questions = [];
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.attempts).toHaveLength(1);
    expect(data.wrongQuestions[0]).toMatchObject({ questionId: 'q1', score: 0, topic: 'Question 2(b)' });
    expect(data.topicUnavailableExams).toEqual([{ examId: 'released', subject: 'Biology', profileId: 'full' }]);
    expect(selectSubjectProfileStats(data, { subjectId: 'subject-id', profileId: 'full' }, now).topicUnavailableCount).toBe(1);
    expect(selectSubjectProfileStats(data, { subjectId: 'subject-id', profileId: 'unprofiled' }, now).topicUnavailableCount).toBe(0);
  });

  it('does not silently discard authorised history whose exam identity is not readable', async () => {
    state.rows.exam_submission_metadata.push({ ...submission('restricted-identity', true), exams: null });
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(data.unavailableExamCount).toBe(1);
    expect(data.attempts.some(row => row.id === 'restricted-identity')).toBe(false);
    expect(state.calls.find(call => call.table === 'exam_submission_metadata')?.steps.find(step => step[0] === 'select')?.[1]).not.toContain('!inner');
  });
  it('does not call incomplete revision tasks recorded study time', async () => {
    for (const [index, is_completed] of [false, null, undefined].entries()) {
      state.rows.revision_tasks.push({ id: `todo-${index}`, user_id: 'owner', subject: 'Biology', date, duration: 120, is_completed });
    }
    const data = await loadSubjectProfileStats('owner', new AbortController().signal, now);
    expect(selectSubjectProfileStats(data, { subjectId: 'subject-id' }, now).unassignedStudyHours).toBe(1);
    expect(state.calls.find(call => call.table === 'revision_tasks')?.steps).toContainEqual(['eq', 'is_completed', true]);
  });

  it('shares the same verified-owner query definition between route preparation and page reads', async () => {
    const store = new WorkspaceStore('owner');
    try {
      const query = subjectProfileStatsQuery(store);
      expect(query.queryKey).toEqual(['workspace-subject-profile-stats:v1', 'owner']);
      const data = await workspaceQueryClient(store).fetchQuery(query);
      expect(data.subjects[0]?.id).toBe('subject-id');
      expect(data.attempts[0]?.id).toBe('released');
    } finally { workspaceQueryClient(store).clear(); }
  });
  it('refuses a changed account in the route preparation query before any metadata is read', async () => {
    state.authOwner = 'someone-else';
    const store = new WorkspaceStore('owner');
    try {
      await expect(subjectProfileStatsQuery(store).queryFn()).rejects.toThrow('Your account changed');
      expect(state.calls).toEqual([]);
    } finally { workspaceQueryClient(store).clear(); }
  });

});
