import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Plus, Grid3x3, List, Filter, Loader2, Star } from "lucide-react";
import { PracticeSetCard } from "@/components/practice/PracticeSetCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";

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
}

interface PracticeSetProgress {
  questions_attempted: number;
  last_accessed_at: string;
  completed_at?: string;
  time_spent_seconds: number;
}

const MyQuizzes = () => {
  const navigate = useNavigate();
  const { subjects } = useUserSubjects();
  const [practiceSets, setPracticeSets] = useState<PracticeSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeTab, setActiveTab] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [sortBy, setSortBy] = useState('date_created');
  const [searchQuery, setSearchQuery] = useState('');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [progressMap, setProgressMap] = useState<Record<string, PracticeSetProgress>>({});
  const [recoveredCount, setRecoveredCount] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadPracticeSets();
    loadFavourites();
    recoverLostSets();
  }, []);

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
        
        toast({
          title: "Practice Sets Restored",
          description: `We've restored ${lostSets.length} practice set${lostSets.length > 1 ? 's' : ''} that were previously unsaved. You can find them below.`,
        });
      }
    } catch (error: any) {
      console.error('Error recovering lost sets:', error);
    }
  };

  const loadPracticeSets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sets, error } = await supabase
        .from('practice_question_sets')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: progressData } = await supabase
        .from('practice_set_progress')
        .select('*')
        .eq('user_id', user.id);

      const progressLookup: Record<string, PracticeSetProgress> = {};
      progressData?.forEach(p => {
        progressLookup[p.set_id] = {
          questions_attempted: p.questions_attempted,
          last_accessed_at: p.last_accessed_at,
          completed_at: p.completed_at,
          time_spent_seconds: p.time_spent_seconds,
        };
      });

      setProgressMap(progressLookup);
      setPracticeSets(sets || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadFavourites = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('favourite_practice_sets')
        .select('set_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setFavourites(new Set(data.map(f => f.set_id)));
    } catch (error: any) {
      console.error('Error loading favourites:', error);
    }
  };

  const handleToggleFavourite = async (setId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (favourites.has(setId)) {
        await supabase
          .from('favourite_practice_sets')
          .delete()
          .eq('user_id', user.id)
          .eq('set_id', setId);
        
        setFavourites(prev => {
          const next = new Set(prev);
          next.delete(setId);
          return next;
        });
      } else {
        await supabase
          .from('favourite_practice_sets')
          .insert({ user_id: user.id, set_id: setId });
        
        setFavourites(prev => new Set(prev).add(setId));
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (setId: string) => {
    try {
      const { error } = await supabase
        .from('practice_question_sets')
        .delete()
        .eq('id', setId);

      if (error) throw error;

      setPracticeSets(prev => prev.filter(s => s.id !== setId));
      toast({ title: "Success", description: "Practice set deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPracticeSets((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const getSubjectColor = (subjectId: string) => {
    const subject = subjects.find(s => s.subject_name === subjectId);
    return subject?.subject_color || '#3B82F6';
  };

  const filteredSets = practiceSets.filter(set => {
    if (activeTab === 'favourites' && !favourites.has(set.id)) return false;
    if (activeTab === 'completed' && !progressMap[set.id]?.completed_at) return false;
    if (filterSubject !== 'all' && set.subject_id !== filterSubject) return false;
    if (searchQuery && !set.set_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">My Quizzes</h1>
            <p className="text-muted-foreground">Practice question sets you've created</p>
          </div>
          <Button onClick={() => navigate('/create-practice-questions')} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create New Set
          </Button>
        </div>

        {/* Filters & Controls */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full lg:w-auto">
            <TabsList>
              <TabsTrigger value="all">All Sets</TabsTrigger>
              <TabsTrigger value="favourites">
                <Star className="h-4 w-4 mr-1" />
                Favorites
              </TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <Input
              placeholder="Search sets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-48"
            />
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={s.subject_name}>{s.subject_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_created">Date Created</SelectItem>
                <SelectItem value="last_accessed">Last Accessed</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Practice Sets Grid/List */}
        {sortedSets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No practice sets found</p>
            <Button onClick={() => navigate('/create-practice-questions')}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Set
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortedSets.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
                {sortedSets.map(set => (
                  <PracticeSetCard
                    key={set.id}
                    set={set}
                    progress={progressMap[set.id] || { questions_attempted: 0, last_accessed_at: set.created_at, time_spent_seconds: 0 }}
                    subjectColor={getSubjectColor(set.subject_id)}
                    onDelete={handleDelete}
                    onToggleFavourite={handleToggleFavourite}
                    isFavourite={favourites.has(set.id)}
                    isRecovered={recoveredCount > 0 && new Date(set.created_at).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyQuizzes;