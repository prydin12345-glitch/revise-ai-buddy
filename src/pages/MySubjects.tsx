import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SubjectsList } from "@/components/stats/SubjectsList";
import { BookOpen } from "lucide-react";

const MySubjects = () => {
  return (
    <DashboardLayout>
      <div className="py-6 px-6 md:px-12 lg:px-16 space-y-8 w-full max-w-[1300px] mx-auto">
        <div className="border-b border-border/70 pb-5">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">My Subjects</h1>
          <p className="text-13 text-muted-foreground mt-1">Pick a subject to manage profiles and topics</p>
        </div>
        <SubjectsList />
      </div>
    </DashboardLayout>
  );
};

export default MySubjects;
