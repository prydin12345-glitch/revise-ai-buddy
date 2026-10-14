import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { SubjectsList } from "@/components/stats/SubjectsList";

const MySubjects = () => {
  return (
    <DashboardLayout>
      <div className="my-subjects-page py-3 md:py-6 md:px-6 lg:px-10 space-y-6 w-full min-w-0 max-w-[1300px] mx-auto">
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
