import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { MySubjectsPanel } from "@/components/stats/MySubjectsPanel";
import { BookOpen } from "lucide-react";

const MySubjects = () => {
  return (
    <DashboardLayout>
      <div className="p-2 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Subjects</h1>
            <p className="text-sm text-muted-foreground">Manage your curriculum, topics & exam profiles</p>
          </div>
        </div>
        <MySubjectsPanel />
      </div>
    </DashboardLayout>
  );
};

export default MySubjects;
