import { useState, type ReactNode } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Minimize2, GripVertical, MessageSquare, List } from 'lucide-react';
import { ExamReviewPanel } from './ExamReviewPanel';
import { QuizReviewPanel } from './QuizReviewPanel';

interface SplitReviewViewProps {
  mode: 'exam' | 'quiz';
  /** For exam: pass the actual exam.id. For quiz: pass the set_id. */
  contextId: string;
  title: string;
  totalScore?: number;
  totalMarks?: number;
  onQuestionClick: (question: any) => void;
  onClose: () => void;
  activeQuestionId?: string | null;
  chatContent: ReactNode;
}

export const SplitReviewView = ({
  mode,
  contextId,
  title,
  totalScore = 0,
  totalMarks = 0,
  onQuestionClick,
  onClose,
  activeQuestionId,
  chatContent,
}: SplitReviewViewProps) => {
  const [mobileTab, setMobileTab] = useState<'chat' | 'questions'>('chat');

  const reviewPanel = mode === 'exam' ? (
    <ExamReviewPanel
      examId={contextId}
      examTitle={title}
      totalScore={totalScore}
      totalMarks={totalMarks}
      onQuestionClick={onQuestionClick}
      activeQuestionId={activeQuestionId}
    />
  ) : (
    <QuizReviewPanel
      setId={contextId}
      setTitle={title}
      onQuestionClick={onQuestionClick}
      activeQuestionId={activeQuestionId}
    />
  );

  const mobileReviewPanel = mode === 'exam' ? (
    <ExamReviewPanel
      examId={contextId}
      examTitle={title}
      totalScore={totalScore}
      totalMarks={totalMarks}
      onQuestionClick={(q) => {
        onQuestionClick(q);
        setMobileTab('chat');
      }}
      activeQuestionId={activeQuestionId}
    />
  ) : (
    <QuizReviewPanel
      setId={contextId}
      setTitle={title}
      onQuestionClick={(q) => {
        onQuestionClick(q);
        setMobileTab('chat');
      }}
      activeQuestionId={activeQuestionId}
    />
  );

  return (
    <div
      className="fixed inset-0 z-[9999] bg-background flex flex-col"
      style={{ animation: 'splitViewExpand 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Reviewing
          </div>
          <div className="text-sm font-semibold text-foreground truncate">{title}</div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 flex-shrink-0"
        >
          <Minimize2 className="w-3.5 h-3.5" />
          Exit review
        </button>
      </div>

      {/* Mobile tab switcher */}
      <div className="md:hidden flex border-b border-border bg-background flex-shrink-0">
        {[
          { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
          { id: 'questions' as const, label: 'Questions', icon: List },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold border-b-2 transition-all ${
                mobileTab === tab.id
                  ? 'text-primary border-primary'
                  : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Desktop: resizable panels */}
      <div className="hidden md:flex flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col bg-background">
              {chatContent}
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/40 transition-colors relative group">
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center">
              <div className="w-4 h-8 rounded bg-border group-hover:bg-primary/60 flex items-center justify-center transition-colors">
                <GripVertical className="w-3 h-3 text-muted-foreground group-hover:text-primary-foreground" />
              </div>
            </div>
          </PanelResizeHandle>
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full">
              {reviewPanel}
            </div>
          </Panel>
        </PanelGroup>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex-1 min-h-0">
        <div className={`h-full ${mobileTab === 'chat' ? 'flex' : 'hidden'} flex-col`}>
          {chatContent}
        </div>
        <div className={`h-full ${mobileTab === 'questions' ? 'block' : 'hidden'}`}>
          {mobileReviewPanel}
        </div>
      </div>

      <style>{`
        @keyframes splitViewExpand {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};
