import { useLocation, useNavigate } from 'react-router-dom';
import MobileTabBar from './MobileTabBar';
import { activeWorkspaceTab, workspaceDestinations, scrollWorkspaceToTop } from '@/lib/workspace-navigation';
import { useEffect } from 'react';
import { useRetainedState } from '@/hooks/use-workspace-session';

export default function MobileBottomNav({ tutor = false, onCreate }: { tutor?: boolean; onCreate: () => void }) {
  const { pathname, search, hash } = useLocation();
  const [lastPaths, setLastPaths] = useRetainedState<Record<string, string>>('navigation:last-paths', {});
  const navigate = useNavigate();
  useEffect(() => {
    const destination = workspaceDestinations(tutor).find(tab => tab.path === pathname);
    if (!destination) return;
    const path = pathname + search + hash;
    setLastPaths(previous => previous[destination.key] === path ? previous : { ...previous, [destination.key]: path });
  }, [pathname, search, hash, tutor, setLastPaths]);
  return <MobileTabBar tutor={tutor} active={activeWorkspaceTab(pathname, tutor)} onNavigate={key => {
    if (key === 'create') { onCreate(); return; }
    const tab = workspaceDestinations(tutor).find(item => item.key === key);
    if (!tab?.path) return;
    if (pathname === tab.path) scrollWorkspaceToTop();
    else navigate(lastPaths[key] || tab.path);
  }} />;
}
