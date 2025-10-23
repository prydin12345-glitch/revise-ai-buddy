import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Settings, Calendar, Loader2, Edit2, Trash2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Exam {
  id: string;
  title: string;
  subject_id: string;
  created_at: string;
  status: string;
  type: string;
  display_order?: number;
  exam_topics: Array<{ topic_name: string }>;
}

interface SortableExamCardProps {
  exam: Exam;
  onEdit: (exam: Exam) => void;
  onDelete: (exam: Exam) => void;
  onView: (exam: Exam) => void;
  onBeginExam: (exam: Exam) => void;
}

const SortableExamCard = ({ exam, onEdit, onDelete, onView, onBeginExam }: SortableExamCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exam.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className="hover:shadow-xl transition-all">
        <CardContent className="p-5">
          <div className="flex items-start gap-3 mb-3">
            <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 hover:text-primary transition-colors">
              <GripVertical className="w-5 h-5" />
            </button>
            <div className="text-3xl">{exam.type === 'generated' ? '🤖' : '📄'}</div>
            <div className="flex-1 cursor-pointer" onClick={() => onView(exam)}>
              <h3 className="font-bold text-lg truncate">{exam.title}</h3>
              <p className="text-sm text-muted-foreground capitalize">{exam.subject_id}</p>
            </div>
            <div className="flex gap-1">
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); onEdit(exam); }}
                className="h-8 w-8 hover:bg-primary/10"
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                onClick={(e) => { e.stopPropagation(); onDelete(exam); }}
                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between items-center pt-3 border-t">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />{new Date(exam.created_at).toLocaleDateString()}
            </div>
            {exam.status === 'published' ? (
              <Button 
                size="sm" 
                className="bg-blue-600 hover:bg-blue-700 h-8"
                onClick={(e) => { e.stopPropagation(); onBeginExam(exam); }}
              >
                Begin Exam
              </Button>
            ) : (
              <span className="text-xs px-2 py-1 bg-accent rounded capitalize">{exam.status}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MyExams = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All Subjects");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [beginExamDialogOpen, setBeginExamDialogOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [editForm, setEditForm] = useState({ title: "", subject_id: "", created_at: "" });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    loadExams();

    const channel = supabase
      .channel('exams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, () => loadExams())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const loadExams = async () => {
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('*, exam_topics(topic_name)')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error: any) {
      toast({ title: "Load Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleView = (exam: Exam) => {
    // Container click routes to preview page
    navigate(`/exam/${exam.id}/preview`);
  };

  const handleBeginExam = (exam: Exam) => {
    setSelectedExam(exam);
    setBeginExamDialogOpen(true);
  };

  const handleConfirmBeginExam = async () => {
    if (!selectedExam) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if student has already submitted this exam
      const { data: submission } = await supabase
        .from('exam_submissions')
        .select('id')
        .eq('exam_id', selectedExam.id)
        .eq('student_id', user.id)
        .maybeSingle();

      setBeginExamDialogOpen(false);

      if (submission) {
        navigate(`/exam/${selectedExam.id}/review`);
      } else {
        navigate(`/exam/${selectedExam.id}/live?mode=student`);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (exam: Exam) => {
    setSelectedExam(exam);
    setEditForm({
      title: exam.title,
      subject_id: exam.subject_id,
      created_at: new Date(exam.created_at).toISOString().split('T')[0],
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedExam) return;

    try {
      const { error } = await supabase
        .from('exams')
        .update({
          title: editForm.title,
          subject_id: editForm.subject_id,
          created_at: editForm.created_at || selectedExam.created_at,
        })
        .eq('id', selectedExam.id);

      if (error) throw error;

      toast({ title: "Success", description: "Exam updated successfully" });
      setEditDialogOpen(false);
      loadExams();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = (exam: Exam) => {
    setSelectedExam(exam);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedExam) return;

    try {
      const { error } = await supabase
        .from('exams')
        .delete()
        .eq('id', selectedExam.id);

      if (error) throw error;

      toast({ title: "Success", description: "Exam deleted successfully" });
      setDeleteDialogOpen(false);
      setExams(exams.filter(e => e.id !== selectedExam.id));
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = filteredExams.findIndex((exam) => exam.id === active.id);
    const newIndex = filteredExams.findIndex((exam) => exam.id === over.id);

    const reorderedExams = arrayMove(filteredExams, oldIndex, newIndex);
    
    // Update local state immediately for smooth UX
    const updatedExams = exams.map(exam => {
      const reorderedIndex = reorderedExams.findIndex(e => e.id === exam.id);
      if (reorderedIndex !== -1) {
        return { ...exam, display_order: reorderedIndex };
      }
      return exam;
    });
    setExams(updatedExams);

    // Persist to database
    try {
      const updates = reorderedExams.map((exam, index) => 
        supabase.from('exams').update({ display_order: index }).eq('id', exam.id)
      );
      await Promise.all(updates);
      toast({ title: "Success", description: "Exam order updated" });
    } catch (error: any) {
      toast({ title: "Reorder Failed", description: error.message, variant: "destructive" });
      loadExams(); // Reload to restore correct order
    }
  };

  const filters = ["All Subjects", "mathematics", "english", "science", "other"];
  const filteredExams = activeFilter === "All Subjects" ? exams : exams.filter(e => e.subject_id === activeFilter);

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-foreground">My Exams</h1>
          <p className="text-lg text-muted-foreground">View, manage, and generate exams.</p>
          
          <div className="flex gap-3">
            <Button size="lg" variant="outline" className="flex-1 h-12" onClick={() => navigate("/upload")}>
              <Upload className="w-5 h-5 mr-2" />Upload New Exam
            </Button>
            <Button size="lg" variant="outline" className="flex-1 h-12" onClick={() => toast({ title: "Coming Soon" })}>
              <Settings className="w-5 h-5 mr-2" />Generate New Exam
            </Button>
          </div>
        </div>

        <div className="flex gap-2 p-6 bg-card/30 rounded-xl">
          {filters.map((filter) => (
            <Button key={filter} onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-5 ${activeFilter === filter ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {filter}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold mb-2">No exams yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first exam to get started</p>
            <Button onClick={() => navigate("/upload")}><Upload className="mr-2" />Upload Exam</Button>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={filteredExams.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExams.map((exam) => (
                  <SortableExamCard 
                    key={exam.id} 
                    exam={exam}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onView={handleView}
                    onBeginExam={handleBeginExam}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exam</DialogTitle>
            <DialogDescription>Update the exam details below</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title</Label>
              <Input 
                id="title" 
                value={editForm.title} 
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Enter exam title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Select value={editForm.subject_id} onValueChange={(value) => setEditForm({ ...editForm, subject_id: value })}>
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mathematics">Mathematics</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="science">Science</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date (Optional)</Label>
              <Input 
                id="date" 
                type="date" 
                value={editForm.created_at} 
                onChange={(e) => setEditForm({ ...editForm, created_at: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedExam?.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Begin Exam Dialog */}
      <AlertDialog open={beginExamDialogOpen} onOpenChange={setBeginExamDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Begin Live Exam</AlertDialogTitle>
            <AlertDialogDescription>
              You're about to start the live exam. Timer will begin and answers will be saved automatically. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBeginExam} className="bg-blue-600 hover:bg-blue-700">
              Start Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyExams;
