import { useState, useRef, useEffect, useCallback, type RefObject } from 'react';
import { GraduationCap, X, Send, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/hooks/useSession';
import { detectIntent, isReviewIntent } from './intent-detector';
import { ExamPickerCard, type ExamPickerItem } from './ExamPickerCard';
import { QuizPickerCard, type QuizPickerItem } from './QuizPickerCard';
import { SplitReviewView } from './SplitReviewView';
import { FollowUpQuestionCard, type FollowUpQuestion } from './FollowUpQuestionCard';
import { SessionSummaryCard, type SessionSummary } from './SessionSummaryCard';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  streaming?: boolean;
  type?: 'text' | 'exam_picker' | 'quiz_picker' | 'selected_exam' | 'selected_quiz' | 'followup_question';
  pickerData?: ExamPickerItem[] | QuizPickerItem[];
  followupQuestion?: FollowUpQuestion;
  followupAnswer?: {
    studentAnswer: string;
    isCorrect: boolean;
    explanation: string;
  };
}

const SESSION_SUMMARY_KEY = 'examly_last_session_summary';

interface AiTutorChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnreadChange?: (count: number) => void;
}

const SUGGESTIONS = [
  'What have I been getting wrong lately?',
  'Review my most recent exam',
  'What topics should I focus on this week?',
  'Explain a topic I am struggling with',
];

// ---- Shared chat content sub-component (used by both compact panel and split view) ----
interface ChatBodyProps {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  loading: boolean;
  rateLimitHit: boolean;
  messagesSentToday: number;
  inputRef: RefObject<HTMLTextAreaElement>;
  bottomRef: RefObject<HTMLDivElement>;
  sendMessage: (text?: string) => void;
  handleExamSelect: (item: ExamPickerItem) => void;
  handleQuizSelect: (item: QuizPickerItem) => void;
  handleFollowupAnswer: (messageId: string, question: FollowUpQuestion, answer: string, isCorrect: boolean) => void;
  savedSummary: SessionSummary | null;
  onDismissSummary: () => void;
  onRevisitSummary: () => void;
}

const ChatBody = ({
  messages,
  input,
  setInput,
  loading,
  rateLimitHit,
  messagesSentToday,
  inputRef,
  bottomRef,
  sendMessage,
  handleExamSelect,
  handleQuizSelect,
  handleFollowupAnswer,
  savedSummary,
  onDismissSummary,
  onRevisitSummary,
}: ChatBodyProps) => (
  <>
    {/* Messages */}
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
      {messages.length === 0 && savedSummary && (
        <SessionSummaryCard
          summary={savedSummary}
          onDismiss={onDismissSummary}
          onRevisit={onRevisitSummary}
        />
      )}

      {messages.length === 0 && (
        <div className="space-y-4">
          <div className="flex gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-[13px] text-foreground leading-relaxed max-w-[85%]">
              Hi! I have access to your exam history and practice results. What would you like help with?
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-1">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-left px-3.5 py-2.5 rounded-xl border border-border text-[12.5px] text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground transition-all duration-150"
                style={{ animation: `aiSuggestionFade 0.3s ease ${i * 0.08}s both` }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.type === 'selected_exam' || msg.type === 'selected_quiz') {
          return (
            <div
              key={msg.id}
              className="flex justify-center"
              style={{ animation: 'aiMessageSlide 0.2s ease both' }}
            >
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                <CheckCircle2 size={11} className="text-primary" />
                <span className="text-[11px] text-primary font-medium">{msg.content}</span>
              </div>
            </div>
          );
        }

        if (msg.type === 'exam_picker' || msg.type === 'quiz_picker') {
          return (
            <div
              key={msg.id}
              className="flex gap-2.5 items-start"
              style={{ animation: 'aiMessageSlide 0.2s ease both' }}
            >
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-2.5 w-fit max-w-[85%]">
                  <p className="text-[13px] text-foreground">{msg.content}</p>
                </div>
                {msg.type === 'exam_picker' && Array.isArray(msg.pickerData) && (
                  <ExamPickerCard
                    items={msg.pickerData as ExamPickerItem[]}
                    onSelect={handleExamSelect}
                  />
                )}
                {msg.type === 'quiz_picker' && Array.isArray(msg.pickerData) && (
                  <QuizPickerCard
                    items={msg.pickerData as QuizPickerItem[]}
                    onSelect={handleQuizSelect}
                  />
                )}
              </div>
            </div>
          );
        }

        if (msg.type === 'followup_question' && msg.followupQuestion) {
          return (
            <div
              key={msg.id}
              className="flex gap-2.5 items-start"
              style={{ animation: 'aiMessageSlide 0.3s ease both' }}
            >
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 max-w-[90%]">
                <FollowUpQuestionCard
                  question={msg.followupQuestion}
                  answered={msg.followupAnswer}
                  onAnswer={(answer, isCorrect) =>
                    handleFollowupAnswer(msg.id, msg.followupQuestion!, answer, isCorrect)
                  }
                />
              </div>
            </div>
          );
        }

        return (
          <div
            key={msg.id}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            style={{ animation: 'aiMessageSlide 0.25s ease-out' }}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                  : 'bg-muted text-foreground rounded-2xl rounded-tl-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <>
                  {msg.streaming && !msg.content ? (
                    <span className="inline-flex gap-1 items-center py-1">
                      {[0, 1, 2].map(j => (
                        <span
                          key={j}
                          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 inline-block"
                          style={{ animation: `aiTypingBounce 1.2s infinite ${j * 0.15}s` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-p:leading-relaxed prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground prose-code:text-foreground prose-code:bg-background/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:text-foreground prose-a:text-primary text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                  {msg.streaming && msg.content && (
                    <span
                      className="inline-block w-[2px] h-[14px] bg-current ml-0.5 align-middle"
                      style={{ animation: 'aiCursorBlink 1s infinite' }}
                    />
                  )}
                </>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        );
      })}

      {rateLimitHit && (
        <div className="text-center py-2">
          <span className="inline-block text-[11px] text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
            Daily message limit reached. Resets at midnight.
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>

    {/* Input */}
    <div className="border-t border-border p-3 bg-background/95 flex-shrink-0">
      {!rateLimitHit && messagesSentToday > 40 && (
        <div className="text-[10px] text-muted-foreground text-right mb-1.5">
          {Math.max(0, 50 - messagesSentToday)} messages remaining today
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={rateLimitHit ? 'Daily limit reached' : 'Ask anything… (Enter to send)'}
            disabled={loading || rateLimitHit}
            rows={1}
            className="w-full resize-none bg-muted/40 border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:bg-muted/60 transition-colors duration-150 leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />
        </div>
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading || rateLimitHit}
          aria-label="Send message"
          className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0 hover:bg-primary/90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150 shadow-sm"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  </>
);

export const AiTutorChat = ({ open, onOpenChange, onUnreadChange }: AiTutorChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread] = useState(0);
  const [rateLimitHit, setRateLimitHit] = useState(false);
  const [messagesSentToday, setMessagesSentToday] = useState(0);
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [completedExams, setCompletedExams] = useState<ExamPickerItem[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<QuizPickerItem[]>([]);
  const [pickerDataLoaded, setPickerDataLoaded] = useState(false);

  // Split-view state
  const [splitViewOpen, setSplitViewOpen] = useState(false);
  const [splitViewMode, setSplitViewMode] = useState<'exam' | 'quiz'>('exam');
  const [splitViewContextId, setSplitViewContextId] = useState('');
  const [splitViewTotalScore, setSplitViewTotalScore] = useState(0);
  const [splitViewTotalMarks, setSplitViewTotalMarks] = useState(0);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const session = useSession();
  const historyLoadedRef = useRef(false);

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(crypto.randomUUID());
    setRateLimitHit(false);
    setSelectedExamId(null);
    setSelectedSetId(null);
    setSelectedTitle(null);
    setActiveQuestionId(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    onUnreadChange?.(unread);
  }, [unread, onUnreadChange]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!open || !session?.user?.id || historyLoadedRef.current) return;
    historyLoadedRef.current = true;

    (async () => {
      const { data } = await supabase
        .from('ai_tutor_messages')
        .select('role, content, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setMessages(
          data.reverse().map((m, i) => ({
            id: `history-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            type: 'text',
          }))
        );
      }
    })();
  }, [open, session?.user?.id]);

  const loadPickerData = useCallback(async () => {
    if (pickerDataLoaded || !session?.user?.id) return;
    try {
      const [examsResult, quizzesResult] = await Promise.all([
        supabase
          .from('exam_submissions')
          .select('id, total_score, total_marks, submitted_at, exams(id, title, subject_id)')
          .eq('student_id', session.user.id)
          .in('status', ['graded', 'submitted'])
          .not('total_score', 'is', null)
          .gt('total_marks', 0)
          .order('submitted_at', { ascending: false })
          .limit(20),
        supabase
          .from('practice_question_sets')
          .select('id, set_name, subject_id, subtopics, question_count, created_at')
          .eq('user_id', session.user.id)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      if (examsResult.data) {
        setCompletedExams(
          examsResult.data
            .filter((e: any) => e.total_marks > 0)
            .map((e: any) => ({
              id: e.id,
              examId: e.exams?.id ?? '',
              title: e.exams?.title ?? 'Untitled Exam',
              subject: e.exams?.subject_id ?? '',
              score: Number(e.total_score),
              totalMarks: Number(e.total_marks),
              pct: Math.round((Number(e.total_score) / Number(e.total_marks)) * 100),
              submittedAt: e.submitted_at,
            }))
        );
      }

      if (quizzesResult.data) {
        setCompletedQuizzes(
          quizzesResult.data.map((s: any) => ({
            id: s.id,
            title:
              s.set_name ||
              (Array.isArray(s.subtopics) ? s.subtopics.slice(0, 2).join(', ') : s.subtopics) ||
              'Practice Quiz',
            subject: s.subject_id ?? '',
            questionCount: s.question_count ?? 0,
            createdAt: s.created_at,
          }))
        );
      }
      setPickerDataLoaded(true);
    } catch (err) {
      console.error('Failed to load picker data:', err);
    }
  }, [session?.user?.id, pickerDataLoaded]);

  useEffect(() => {
    if (open) loadPickerData();
  }, [open, loadPickerData]);

  const streamAiResponse = useCallback(async (
    msg: string,
    history: Array<{ role: string; content: string }>,
    examId: string | null,
    setId: string | null,
  ) => {
    setLoading(true);
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      type: 'text',
      streaming: true,
    }]);

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) throw new Error('No session');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tutor-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            message: msg,
            conversationHistory: history,
            selectedExamId: examId ?? undefined,
            selectedSetId: setId ?? undefined,
          }),
        }
      );

      if (response.status === 429) {
        const data = await response.json().catch(() => ({ message: 'Rate limit reached.' }));
        setRateLimitHit(true);
        setMessages(prev => prev.map(m => m.id === assistantId
          ? { ...m, content: data.message || 'Daily message limit reached.', streaming: false }
          : m));
        return;
      }

      if (!response.ok || !response.body) throw new Error('AI service error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.token) {
              fullContent += parsed.token;
              setMessages(prev => prev.map(m =>
                m.id === assistantId ? { ...m, content: fullContent } : m));
            }
          } catch { /* skip */ }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, streaming: false } : m));
      setMessagesSentToday(n => n + 1);
      if (!open && !splitViewOpen) setUnread(u => u + 1);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: 'Sorry, something went wrong. Please try again.', streaming: false }
          : m));
    } finally {
      setLoading(false);
    }
  }, [open, splitViewOpen]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading || !session) return;

    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: msg,
      type: 'text',
    }]);

    const intent = detectIntent(msg);
    if (isReviewIntent(intent) && !selectedExamId && !selectedSetId) {
      await new Promise(r => setTimeout(r, 400));

      if (intent === 'exam_review' && completedExams.length > 0) {
        setMessages(prev => [...prev, {
          id: `picker-${Date.now()}`,
          role: 'assistant',
          content: 'Which exam would you like to review?',
          type: 'exam_picker',
          pickerData: completedExams,
        }]);
        return;
      }

      if (intent === 'quiz_review' && completedQuizzes.length > 0) {
        setMessages(prev => [...prev, {
          id: `picker-${Date.now()}`,
          role: 'assistant',
          content: 'Which practice quiz would you like to review?',
          type: 'quiz_picker',
          pickerData: completedQuizzes,
        }]);
        return;
      }

      if (intent === 'general_review') {
        const hasExams = completedExams.length > 0;
        const hasQuizzes = completedQuizzes.length > 0;
        if (hasExams || hasQuizzes) {
          const useExams = completedExams.length >= completedQuizzes.length;
          setMessages(prev => [...prev, {
            id: `picker-${Date.now()}`,
            role: 'assistant',
            content: 'What would you like to review?',
            type: useExams ? 'exam_picker' : 'quiz_picker',
            pickerData: useExams ? completedExams : completedQuizzes,
          }]);
          return;
        }
      }
    }

    const history = messages.slice(-8)
      .map(m => ({
        role: m.role === 'system' ? 'assistant' : m.role,
        content: m.content,
      }))
      .filter(m => m.role === 'user' || m.role === 'assistant');

    await streamAiResponse(msg, history, selectedExamId, selectedSetId);
  }, [input, loading, messages, session, selectedExamId, selectedSetId, completedExams, completedQuizzes, streamAiResponse]);

  const handleExamSelect = useCallback((item: ExamPickerItem) => {
    setSelectedExamId(item.id);
    setSelectedTitle(item.title);

    // Open split view using actual exam.id for question lookups
    setSplitViewMode('exam');
    setSplitViewContextId(item.examId || item.id);
    setSplitViewTotalScore(item.score);
    setSplitViewTotalMarks(item.totalMarks);
    setSplitViewOpen(true);
    setActiveQuestionId(null);

    const followUp = `Let's review my ${item.title} exam. I scored ${item.pct}%. Walk me through what I got wrong.`;

    setMessages(prev => [
      ...prev,
      {
        id: `selected-${Date.now()}`,
        role: 'system',
        content: `Selected: ${item.title} (${item.pct}%)`,
        type: 'selected_exam',
      },
      {
        id: `user-followup-${Date.now()}`,
        role: 'user',
        content: followUp,
        type: 'text',
      },
    ]);

    setTimeout(() => {
      streamAiResponse(followUp, [], item.id, null);
    }, 300);
  }, [streamAiResponse]);

  const handleQuizSelect = useCallback((item: QuizPickerItem) => {
    setSelectedSetId(item.id);
    setSelectedTitle(item.title);

    setSplitViewMode('quiz');
    setSplitViewContextId(item.id);
    setSplitViewTotalScore(0);
    setSplitViewTotalMarks(0);
    setSplitViewOpen(true);
    setActiveQuestionId(null);

    const followUp = `Let's review my ${item.title} practice quiz. Walk me through what I got wrong.`;

    setMessages(prev => [
      ...prev,
      {
        id: `selected-${Date.now()}`,
        role: 'system',
        content: `Selected: ${item.title}`,
        type: 'selected_quiz',
      },
      {
        id: `user-followup-${Date.now()}`,
        role: 'user',
        content: followUp,
        type: 'text',
      },
    ]);

    setTimeout(() => {
      streamAiResponse(followUp, [], null, item.id);
    }, 300);
  }, [streamAiResponse]);

  const handleQuestionClick = useCallback((question: any) => {
    setActiveQuestionId(question.id);

    const questionContext = [
      `I want to understand Q${question.questionNumber}: "${question.questionText}"`,
      `I answered: "${question.studentAnswer}"`,
      question.isCorrect
        ? `I got this right (${question.score}/${question.totalMarks} marks).`
        : `I got this wrong (${question.score}/${question.totalMarks} marks). The correct answer was: "${question.correctAnswer}"`,
      question.feedback ? `The feedback was: "${question.feedback}"` : null,
      'Please explain this question clearly and tell me how to approach it correctly.',
    ].filter(Boolean).join(' ');

    setMessages(prev => [...prev, {
      id: `user-q-${Date.now()}`,
      role: 'user',
      content: questionContext,
      type: 'text',
    }]);

    streamAiResponse(questionContext, [], selectedExamId, selectedSetId);
  }, [selectedExamId, selectedSetId, streamAiResponse]);

  const handleCloseSplitView = useCallback(() => {
    setSplitViewOpen(false);
    setActiveQuestionId(null);
  }, []);

  if (!session) return null;

  const chatBody = (
    <ChatBody
      messages={messages}
      input={input}
      setInput={setInput}
      loading={loading}
      rateLimitHit={rateLimitHit}
      messagesSentToday={messagesSentToday}
      inputRef={inputRef}
      bottomRef={bottomRef}
      sendMessage={sendMessage}
      handleExamSelect={handleExamSelect}
      handleQuizSelect={handleQuizSelect}
    />
  );

  return (
    <>
      {/* Split review view */}
      {splitViewOpen && (
        <SplitReviewView
          mode={splitViewMode}
          contextId={splitViewContextId}
          title={selectedTitle || ''}
          totalScore={splitViewTotalScore}
          totalMarks={splitViewTotalMarks}
          onQuestionClick={handleQuestionClick}
          onClose={handleCloseSplitView}
          activeQuestionId={activeQuestionId}
          chatContent={chatBody}
        />
      )}

      {/* Compact panel — only when split view is closed */}
      {open && !splitViewOpen && (
        <div
          className="fixed bg-background border border-border shadow-2xl flex flex-col z-[9998] rounded-2xl overflow-hidden
            inset-x-3 bottom-24 top-20
            sm:inset-x-auto sm:right-6 sm:bottom-24 sm:top-auto sm:w-[400px] sm:h-[600px]"
          style={{ animation: 'aiChatPopUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-sm">
                  <GraduationCap className="w-4 h-4 text-primary-foreground" strokeWidth={2.2} />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
              </div>
              <div className="leading-tight min-w-0">
                <div className="text-sm font-semibold text-foreground">AI Tutor</div>
                <div className="text-[11px] text-muted-foreground">Online</div>
              </div>
            </div>

            {selectedTitle && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 max-w-[140px] flex-shrink min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                <span className="text-[10px] text-primary font-medium truncate">{selectedTitle}</span>
                <button
                  onClick={() => {
                    setSelectedExamId(null);
                    setSelectedSetId(null);
                    setSelectedTitle(null);
                  }}
                  className="flex-shrink-0 text-primary/60 hover:text-primary transition-colors"
                  aria-label="Clear context"
                >
                  <X size={9} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleNewChat}
                title="New chat"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
              >
                <Plus className="w-3 h-3" />
                New
              </button>
              {messages.length > 0 && (
                <button
                  onClick={handleClearChat}
                  title="Clear chat"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                onClick={() => onOpenChange(false)}
                aria-label="Close chat"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {chatBody}
        </div>
      )}

      <style>{`
        @keyframes aiChatPopUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes aiCursorBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes aiTypingBounce {
          0%, 80%, 100% { transform: translateY(0);    }
          40%            { transform: translateY(-4px); }
        }
        @keyframes aiMessageSlide {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes aiSuggestionFade {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </>
  );
};
