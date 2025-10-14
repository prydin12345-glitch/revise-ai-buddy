import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function ExamInProgress() {
  const { examId } = useParams();

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#0f1727] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 rounded-lg p-8 border border-white/10 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Exam In Progress</h1>
            <p className="text-muted-foreground mb-8">
              Exam ID: {examId}
            </p>
            <p className="text-white">
              This page will display the exam questions and allow students to submit answers.
            </p>
            <p className="text-muted-foreground mt-4">
              (Implementation placeholder - full exam UI coming soon)
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
