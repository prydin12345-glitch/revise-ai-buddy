import { prefetchRoute } from "@/lib/prefetch-routes";
import { House, LibraryBig, BookOpen, Users, Plus, UserRound } from 'lucide-react';
import { workspaceDestinations, type WorkspaceTab } from '@/lib/workspace-navigation';

export type TabKey = WorkspaceTab;
interface Props {
  active?: TabKey;
  tutor?: boolean;
  onNavigate?: (key: TabKey) => void;
}
export default function MobileTabBar({ active, tutor = false, onNavigate }: Props) {
  const icons = { home: House, practice: LibraryBig, create: Plus, subjects: BookOpen, students: Users, profile: UserRound };
  return (
    <nav aria-label="Primary navigation" className="examly-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card xl:hidden">
      <div className="mx-auto flex max-w-3xl px-2">
        {workspaceDestinations(tutor).map(tab => {
          const selected = tab.key !== 'create' && active === tab.key;
          const Icon = icons[tab.key];
          return (
            <button key={tab.key} data-workspace-create={tab.key === 'create' ? '' : undefined} type="button" onPointerDown={() => { if (tab.path) prefetchRoute(tab.path); }} onFocus={() => { if (tab.path) prefetchRoute(tab.path); }} onClick={() => onNavigate?.(tab.key)} aria-current={selected ? 'page' : undefined}
              title={tab.key === 'practice' ? 'Exams and quizzes' : undefined}
              aria-haspopup={tab.key === 'create' ? 'dialog' : undefined}
              className={`flex min-h-[68px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-md ${tab.key === 'create' ? 'bg-primary text-primary-foreground' : selected ? 'bg-accent' : ''}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
