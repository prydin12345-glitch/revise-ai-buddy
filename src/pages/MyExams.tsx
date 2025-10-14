import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, Settings, FileText, Brain, Calendar, Loader2 } from "lucide-react";

interface Exam {
  id: string;
  title: string;
  subject_id: string;
  created_at: string;
  status: string;
  type: string;
  exam_topics: Array<{ topic_name: string }>;
}

const MyExams = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("All Subjects");
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExams(data || []);
    } catch (error: any) {
      toast({ title: "Load Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filters = ["All Subjects", "mathematics", "english", "science"];
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
              className={`rounded-full px-5 ${activeFilter === filter ? "bg-[#1e40af] text-white" : "bg-[#374151] text-muted-foreground"}`}>
              {filter}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" /></div>
        ) : filteredExams.length === 0 ? (
          <div className="text-center py-20">
            <h3 className="text-2xl font-semibold mb-2">No exams yet</h3>
            <p className="text-muted-foreground mb-6">Upload your first exam to get started</p>
            <Button onClick={() => navigate("/upload")}><Upload className="mr-2" />Upload Exam</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExams.map((exam) => (
              <Card key={exam.id} className="cursor-pointer hover:shadow-xl transition-all" onClick={() => navigate(`/exam/${exam.id}/in-progress`)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-3xl">{exam.type === 'generated' ? '🤖' : '📄'}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg truncate">{exam.title}</h3>
                      <p className="text-sm text-muted-foreground capitalize">{exam.subject_id}</p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-3 border-t">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />{new Date(exam.created_at).toLocaleDateString()}
                    </div>
                    <span className="text-xs px-2 py-1 bg-white/10 rounded capitalize">{exam.status}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyExams;
