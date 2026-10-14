import { useLocation, useNavigate } from 'react-router-dom';
import MobileTabBar from './MobileTabBar';
import { activeWorkspaceTab, workspaceDestinations, scrollWorkspaceToTop, isWorkspaceListRoute } from '@/lib/workspace-navigation';
import { useEffect } from 'react';
import { useRetainedState } from '@/hooks/use-workspace-session';

export default function MobileBottomNav({ tutor = false, onCreate }: { tutor?: boolean; onCreate: () => void }) {
  const { pathname, search, hash } = useLocation();
  const [lastPaths, setLastPaths] = useRetainedState<Record<string, string>>('navigation:last-paths:v2', {});
  const navigate = useNavigate();
  useEffect(() => {
    const key = activeWorkspaceTab(pathname, tutor);
    if (!key || !isWorkspaceListRoute(pathname, tutor)) return;
    const path = pathname + search + hash;
    setLastPaths(previous => previous[key] === path ? previous : { ...previous, [key]: path });
  }, [pathname, search, hash, tutor, setLastPaths]);
  return <MobileTabBar tutor={tutor} active={activeWorkspaceTab(pathname, tutor)} onNavigate={key => {
    if (key === 'create') { onCreate(); return; }
    const tab = workspaceDestinations(tutor).find(item => item.key === key);
    if (!tab?.path) return;
    if (activeWorkspaceTab(pathname, tutor) === key && isWorkspaceListRoute(pathname, tutor)) scrollWorkspaceToTop();
    else navigate(lastPaths[key] || tab.path);
  }} />;
}
