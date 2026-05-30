// src/components/dashboard/mobile/MobileShell.tsx
// Optional scaffold: dark safe-area screen + scroll region + speed-dial + tab bar.
// Use it ONLY where you want the new chrome (e.g. the dashboard route). Your other
// screens can keep their existing layout — just pass them as children when you
// navigate, or don't use MobileShell for them at all.
import MobileSpeedDial from "./MobileSpeedDial";
import MobileTabBar, { type TabKey } from "./MobileTabBar";

interface MobileShellProps {
  active: TabKey;
  onNavigate?: (key: TabKey) => void;
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
  onAskAI?: () => void;
  children: React.ReactNode;
}

export default function MobileShell({
  active, onNavigate, onCreateExam, onCreateQuiz, onAskAI, children,
}: MobileShellProps) {
  return (
    <div className="relative mx-auto flex h-[100dvh] max-w-md flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* scroll region (leaves room for tab bar) */}
      <div className="flex-1 overflow-y-auto pb-28 pt-4 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {children}
      </div>

      <MobileSpeedDial onCreateExam={onCreateExam} onCreateQuiz={onCreateQuiz} onAskAI={onAskAI} />
      <MobileTabBar active={active} onNavigate={onNavigate} />
    </div>
  );
}
