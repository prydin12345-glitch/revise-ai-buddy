import { quizLibraryQuery } from "@/lib/library-navigation-data";
import { workspaceQueryClient } from "@/lib/workspace-query-client";
import { LibrarySubjectShelf } from "@/components/shared/LibrarySubjectShelf";
import { LibraryDeleteDialog } from "@/components/shared/LibraryDeleteDialog";
import { useLibraryItemActions } from "@/hooks/use-library-item-actions";
import { LIBRARY_REVISION } from "@/lib/library-item-cache";
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Filter, Loader2, Star, LayoutList, CheckCheck, Search, ArrowUpDown, X, Archive } from "lucide-react";
import { PracticeSetCard } from "@/components/practice/PracticeSetCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EXAM_BOARD_OPTIONS } from "@/lib/board-scrubber";
import { useRetainedState, useWorkspaceSession } from "@/hooks/use-workspace-session";
import { RefreshableList } from "@/components/shared/RefreshableList";
import { LoadError } from "@/components/shared/ListFeedback";
import { useOptimisticFavourites } from "@/hooks/use-optimistic-favourites";
import { PracticeLibraryHeader, LibrarySkeleton } from "@/components/shared/PracticeLibraryHeader";

interface PracticeSet {
  id: string;
  set_name: string;
  subject_id: string;
  subtopics: string[];
  difficulty_mode: string;
  difficulty_level: string;
  question_count: number;
  created_at: string;
  educational_tier?: string;
  exam_board?: string;
  status: string;
  user_id?: string;
}

interface PracticeSetProgress {
  questions_attempted: number;
  last_accessed_at: string;
  completed_at?: string;
  time_spent_seconds: number;
}

type TabType = 'all' | 'favourites' | 'completed' | 'archive';
type SortType = 'date_created' | 'last_accessed' | 'progress' | 'name';

const TABS: { value: TabType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'all', label: 'All quizzes', icon: LayoutList },
  { value: 'favourites', label: 'Favourites', icon: Star },
  { value: 'completed', label: 'Completed', icon: CheckCheck },
  { value: 'archive', label: 'Archive', icon: Archive },
];

const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'date_created', label: 'Date Created' },
  { value: 'last_accessed', label: 'Last Accessed' },
  { value: 'progress', label: 'Progress' },
  { value: 'name', label: 'Name (A–Z)' },
];

const MyQuizzes = () => {
  const navigate = useNavigate();
  const { subjects } = useUserSubjects();
  const [practiceSets, setPracticeSets] = useRetainedState<PracticeSet[]>("quizzes:practiceSets", []);
  const { ownerId, ready, store } = useWorkspaceSession();
  const [libraryRevision] = useRetainedState(LIBRARY_REVISION, 0);
  const itemActions = useLibraryItemActions("quiz");
  const [loaded, setLoaded] = useRetainedState("quizzes:loaded", false);
  const [loading, setLoading] = useState(!loaded);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequest = useRef<Promise<void> | null>(null);
  const loadedRevision = useRef<number | null>(null);
  const listActions = useRef<{ load: () => Promise<void>; favourites: () => Promise<void>; recover: () => Promise<void> }>();
  const [activeTab, setActiveTab] = useRetainedState<TabType>("quizzes:activeTab", 'all');
  const [filterSubject, setFilterSubject] = useRetainedState("quizzes:filterSubject", 'all');
  const [filterBoard, setFilterBoard] = useRetainedState("quizzes:filterBoard", 'all');
  const [sortBy, setSortBy] = useRetainedState<SortType>("quizzes:sortBy", 'date_created');
  const [searchQuery, setSearchQuery] = useRetainedState("quizzes:searchQuery", '');
  const [debouncedSearch, setDebouncedSearch] = useRetainedState("quizzes:debouncedSearch", '');
  const [favourites, setFavourites] = useRetainedState<Set<string>>("quizzes:favourites", new Set());
  const [progressMap, setProgressMap] = useRetainedState<Record<string, PracticeSetProgress>>("quizzes:progressMap", {});
  const [totalMarks, setTotalMarks] = useRetainedState<Record<string, number | null>>("quizzes:totalMarks", {});
  const [recoveredCount, setRecoveredCount] = useState(0);



  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, setDebouncedSearch]);

  useEffect(() => {
    if (!ready) return;
    setLoading(!store.get("quizzes:loaded", false));
    if (loadedRevision.current !== libraryRevision) void listActions.current?.load();
    void listActions.current?.favourites();
    void listActions.current?.recover();
  }, [ownerId, ready, store, libraryRevision]);

  const recoverLostSets = async () => {
    try {
      const recoveredFlag = localStorage.getItem('practice_sets_recovered');
      if (recoveredFlag) return;

      const { data: lostSets, error } = await supabase
        .from('practice_question_sets')
        .select('id')
        .eq('extraction_status', 'completed')
        .eq('status', 'draft');

      if (error) throw error;

      if (lostSets && lostSets.length > 0) {
        const { error: updateError } = await supabase
          .from('practice_question_sets')
          .update({ status: 'published' })
          .eq('extraction_status', 'completed')
          .eq('status', 'draft');

        if (updateError) throw updateError;

        setRecoveredCount(lostSets.length);
        localStorage.setItem('practice_sets_recovered', 'true');
        // Prepared data can predate this confirmed publication. Reload the
        // opened list rather than reusing its pre-recovery status snapshot.
        store.set("navigation:quiz-library", null, null);
        store.set<number>(LIBRARY_REVISION, value => value + 1, 0);
        await workspaceQueryClient(store).cancelQueries({ queryKey: ["workspace-library", "quiz"] });

        toast({
          title: "Practice Sets Restored",
          description: `We've restored ${lostSets.length} practice set${lostSets.length > 1 ? 's' : ''} that were previously unsaved. You can find them below.`,
        });
      }
    } catch (error: any) {
      console.error('Error recovering lost sets:', error);
    }
  };

  const loadPracticeSets = (): Promise<void> => {
    if (loadRequest.current) return loadRequest.current;
    const revision = store.get(LIBRARY_REVISION, 0);
    let superseded = false;
    const request = (async () => {
      setLoadError(null);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const prepared = store.get<Awaited<ReturnType<ReturnType<typeof quizLibraryQuery>["queryFn"]>> | null>("navigation:quiz-library", null);
        store.set("navigation:quiz-library", null, null);
        const snapshot = prepared || await workspaceQueryClient(store).fetchQuery({ ...quizLibraryQuery(store), staleTime: 0 });
        if (revision !== store.get(LIBRARY_REVISION, 0)) { superseded = true; return; }
        if (snapshot.marksError) setLoadError("Couldn’t load mark totals. Your quizzes are still available; retry to load the totals.");
        setTotalMarks(snapshot.totalMarks);
        setProgressMap(snapshot.progressMap);
        setPracticeSets(snapshot.sets);
        setLoaded(true);
        loadedRevision.current = revision;
      } catch (error: any) {
        if (revision !== store.get(LIBRARY_REVISION, 0)) { superseded = true; return; }
        setLoadError(error.message || "Couldn’t load your practice sets.");
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
        loadRequest.current = null;
        if (superseded) queueMicrotask(() => {
          if (loadedRevision.current !== store.get(LIBRARY_REVISION, 0)) void listActions.current?.load();
        });
      }
    })();
    loadRequest.current = request;
    return request;
  };

  const loadFavourites = async () => {
    const version = favouriteAction.version();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_practice_sets')
        .select('set_id')
        .eq('user_id', user.id);

      if (error) throw error;
      if (version === favouriteAction.version()) setFavourites(favouriteAction.reconcile(new Set(data.map(f => f.set_id))));
    } catch (error: any) {
      setLoadError(error.message || 'Couldn’t load your favourites.');
    }
  };

  listActions.current = { load: loadPracticeSets, favourites: loadFavourites, recover: recoverLostSets };

  const favouriteAction = useOptimisticFavourites(favourites, setFavourites, async (setId, selected) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || (ownerId && user.id !== ownerId)) throw new Error('Sign in to save favourites.');
    const result = selected
      ? await supabase.from('favourite_practice_sets').insert({ user_id: user.id, set_id: setId })
      : await supabase.from('favourite_practice_sets').delete().eq('user_id', user.id).eq('set_id', setId);
    if (result.error) throw result.error;
  });

  const getSubjectColor = (subjectId: string) => {
    const subject = subjects.find(s => s.subject_name === subjectId);
    return subject?.subject_color || '#3B82F6';
  };

  const filteredSets = practiceSets.filter(set => {
    if (activeTab === 'archive' ? set.status !== 'archived' : set.status === 'archived') return false;
    if (activeTab === 'favourites' && !favourites.has(set.id)) return false;
    if (activeTab === 'completed' && !progressMap[set.id]?.completed_at) return false;
    if (filterSubject !== 'all' && set.subject_id !== filterSubject) return false;
    if (filterBoard !== 'all' && set.exam_board !== filterBoard) return false;
    if (debouncedSearch && !set.set_name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const sortedSets = [...filteredSets].sort((a, b) => {
    switch (sortBy) {
      case 'date_created':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case 'last_accessed':
        const aAccessed = progressMap[a.id]?.last_accessed_at || a.created_at;
        const bAccessed = progressMap[b.id]?.last_accessed_at || b.created_at;
        return new Date(bAccessed).getTime() - new Date(aAccessed).getTime();
      case 'progress':
        const aProgress = progressMap[a.id]?.questions_attempted || 0;
        const bProgress = progressMap[b.id]?.questions_attempted || 0;
        return bProgress - aProgress;
      case 'name':
        return a.set_name.localeCompare(b.set_name);
      default:
        return 0;
    }
  });

  const getSortLabel = () => {
    return SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Sort';
  };


  return (
    <DashboardLayout>
      <RefreshableList onRefresh={() => Promise.all([loadPracticeSets(), loadFavourites()])}>
      <div className="practice-library">
        <PracticeLibraryHeader action={
          <Button onClick={() => navigate('/create-practice-questions')} className="gap-2">
            <Plus className="w-4 h-4" aria-hidden="true" />
            Create quiz
          </Button>
        } />

        {/* Library search, filters and status */}
        <div className="library-toolbar">
          <div className="library-toolbar-layout">
            {/* Search */}
            <div className="library-search">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search quizzes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-12 h-11"
                aria-label="Search quizzes"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="library-search-clear"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort and filter controls */}
            <div className="library-filter-actions">
              {/* Subject Filter */}
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="library-select h-11" aria-label="Filter by subject">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Board Filter */}
              {(() => {
                const uniqueBoards = [...new Set(practiceSets.map(s => s.exam_board).filter(Boolean))] as string[];
                if (uniqueBoards.length === 0) return null;
                return (
                  <Select value={filterBoard} onValueChange={setFilterBoard}>
                    <SelectTrigger className="library-select h-11" aria-label="Filter by exam board">
                      <SelectValue placeholder="All Boards" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Boards</SelectItem>
                      {uniqueBoards.map(boardId => {
                        const boardOption = EXAM_BOARD_OPTIONS.find(b => b.id === boardId);
                        return (
                          <SelectItem key={boardId} value={boardId}>
                            {boardOption?.name || boardId}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                );
              })()}

              {/* Sort Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="library-icon-button h-11 shrink-0" title={getSortLabel()} aria-label="Sort quizzes">
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="sr-only">{getSortLabel()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`cursor-pointer ${sortBy === option.value ? 'bg-accent' : ''}`}
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {/* Status filters */}
            <div className="library-status-scroll">
              <div className="library-status-filters" aria-label="Quiz status">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setActiveTab(tab.value)}
                      className="library-status-filter"
                      aria-pressed={activeTab === tab.value}
                      aria-label={`Filter by ${tab.label}`}
                    >
                      <Icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>


        {loadError && <LoadError message={loadError} onRetry={() => void Promise.all([loadPracticeSets(), loadFavourites()])} />}
        {/* Practice Sets grouped by subject */}
        {loading && !loaded ? <LibrarySkeleton /> : !loaded && loadError ? null : sortedSets.length === 0 ? (
          <div className="library-empty">
            <h3 className="text-2xl font-semibold mb-2">No practice quizzes found</h3>
            <p className="text-muted-foreground mb-6">Try another search or filter, or create a new quiz.</p>
            <Button onClick={() => navigate('/create-practice-questions')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Set
            </Button>
          </div>
        ) : (
          (() => {
            const groups = new Map<string, typeof sortedSets>();
            sortedSets.forEach((set) => {
              const key = set.subject_id || "Other";
              if (!groups.has(key)) groups.set(key, [] as typeof sortedSets);
              groups.get(key)!.push(set);
            });

            return (
              <div className="library-subjects">
                {Array.from(groups.entries()).map(([subjectName, setsInGroup]) => {
                  const subjectColor = getSubjectColor(subjectName);
                  return (
                    <LibrarySubjectShelf key={subjectName} subject={subjectName} color={subjectColor} count={setsInGroup.length}>
                          {setsInGroup.map((set) => (
                            <div
                              key={set.id}
                              className="min-w-0"
                            >
                              <PracticeSetCard
                                set={set}
                                progress={progressMap[set.id] || { questions_attempted: 0, last_accessed_at: set.created_at, time_spent_seconds: 0 }}
                                subjectColor={subjectColor}
                                totalMarks={totalMarks[set.id]}
                                actions={set.user_id === ownerId ? { canArchive: ['published', 'archived'].includes(set.status), pending: itemActions.pending.has(set.id), onDelete: () => itemActions.requestDelete({ ...set, title: set.set_name }), onArchive: () => void itemActions.archive({ ...set, title: set.set_name }) } : undefined}
                                favourite={{ selected: favourites.has(set.id), pending: favouriteAction.pending.has(set.id), failed: favouriteAction.failed.has(set.id), onToggle: () => void favouriteAction.toggle(set.id) }}
                              />
                            </div>
                          ))}
                    </LibrarySubjectShelf>
                  );
                })}
              </div>
            );
          })()
        )}
      </div>
      </RefreshableList>
      <LibraryDeleteDialog title={itemActions.deleteItem?.title} pending={!!itemActions.deleteItem && itemActions.pending.has(itemActions.deleteItem.id)} error={itemActions.deleteError} onCancel={itemActions.closeDelete} onConfirm={() => void itemActions.confirmDelete()} />
    </DashboardLayout>
  );
};

export default MyQuizzes;
