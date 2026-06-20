import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, BookOpen, Loader2, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getBoardDisplayName } from '@/lib/board-scrubber';
import { getRegionBoards } from '@/lib/board-level-mapping';
import { toast } from 'sonner';

interface SubjectRow {
  id: string;
  subject_name: string;
  subject_color: string | null;
  exam_board: string | null;
}

interface ExamBoardListProps {
  curriculumRegion?: string | null;
}

const UNASSIGNED = '__unassigned__';

export const ExamBoardList = ({ curriculumRegion }: ExamBoardListProps) => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBoard, setEditBoard] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('user_subjects')
        .select('id, subject_name, subject_color, exam_board')
        .eq('user_id', user.id)
        .order('subject_name');
      setSubjects((data ?? []) as SubjectRow[]);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSubjects(); }, [loadSubjects]);

  const grouped = subjects.reduce<Record<string, SubjectRow[]>>((acc, s) => {
    const board = s.exam_board?.trim() || UNASSIGNED;
    (acc[board] ||= []).push(s);
    return acc;
  }, {});

  const sortedBoards = Object.keys(grouped).sort((a, b) => {
    if (a === UNASSIGNED) return 1;
    if (b === UNASSIGNED) return -1;
    return getBoardDisplayName(a).localeCompare(getBoardDisplayName(b));
  });

  const boardOptions = getRegionBoards(curriculumRegion ?? 'GB');

  const handleSaveBoard = async (subjectId: string) => {
    setSaving(true);
    try {
      const newBoard = editBoard || null;
      const { error } = await supabase
        .from('user_subjects')
        .update({ exam_board: newBoard })
        .eq('id', subjectId);
      if (error) throw error;

      // Nicety: fill in any null/empty profile boards so they inherit visibly.
      // Never overwrite an explicit profile board.
      const subject = subjects.find(s => s.id === subjectId);
      if (subject && newBoard) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('subject_exam_profiles')
            .update({ exam_board: newBoard })
            .eq('user_id', user.id)
            .eq('subject_name', subject.subject_name)
            .or('exam_board.is.null,exam_board.eq.');
        }
      }

      toast.success('Exam board updated');
      setEditingId(null);
      loadSubjects();
    } catch (err) {
      console.error('Failed to update board:', err);
      toast.error('Could not update exam board');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
          <BookOpen className="w-6 h-6 text-muted-foreground" />
        </div>
        <h4 className="text-sm font-semibold text-foreground mb-1">No subjects yet</h4>
        <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
          Add your subjects and set their exam boards so your exams and quizzes
          are generated in the right style for each one.
        </p>
        <button
          onClick={() => navigate('/my-subjects')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add your subjects
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {sortedBoards.map(board => {
        const isUnassigned = board === UNASSIGNED;
        const boardLabel = isUnassigned ? 'No exam board set' : getBoardDisplayName(board);
        return (
          <div key={board} className="space-y-2">
            <div className={`flex items-center justify-between px-3 py-2 rounded-md ${isUnassigned ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-muted/50'}`}>
              <span className={`text-[12px] font-semibold uppercase tracking-wider ${isUnassigned ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>
                {boardLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {grouped[board].length} {grouped[board].length === 1 ? 'subject' : 'subjects'}
              </span>
            </div>

            <div className="divide-y divide-border rounded-md border border-border">
              {grouped[board].map(subject => (
                <div key={subject.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: subject.subject_color ?? '#94a3b8' }}
                  />
                  <span className="flex-1 text-[13px] font-medium text-foreground truncate">
                    {subject.subject_name}
                  </span>

                  {editingId === subject.id ? (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editBoard}
                        onChange={(e) => setEditBoard(e.target.value)}
                        className="text-[12px] rounded-md border border-border bg-background px-2 py-1 outline-none focus:border-primary/50"
                        autoFocus
                      >
                        <option value="">No board</option>
                        {boardOptions.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveBoard(subject.id)}
                        disabled={saving}
                        className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50"
                        aria-label="Save"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(subject.id);
                        setEditBoard(subject.exam_board ?? '');
                      }}
                      className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="w-3 h-3" />
                      {isUnassigned ? 'Set board' : 'Change'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <button
        onClick={() => navigate('/my-subjects')}
        className="flex items-center gap-2 text-[12px] text-primary hover:text-primary/80 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add or manage subjects
      </button>
    </div>
  );
};
