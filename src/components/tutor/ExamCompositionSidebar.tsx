import { Clock, FileText, Hash } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface Question {
  id: string;
  questionText: string;
  maxMarks: number;
  topicTag?: string;
}

interface ExamCompositionSidebarProps {
  questions: Question[];
  subjectColor?: string;
}

const CHART_COLORS = [
  "hsl(210, 85%, 60%)",
  "hsl(160, 70%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(30, 90%, 55%)",
  "hsl(340, 75%, 55%)",
  "hsl(190, 80%, 45%)",
];

export function ExamCompositionSidebar({ questions, subjectColor }: ExamCompositionSidebarProps) {
  const totalMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
  const estimatedMinutes = Math.ceil(totalMarks * 1.5);

  // Topic distribution
  const topicCounts: Record<string, number> = {};
  questions.forEach((q) => {
    const tag = q.topicTag || "Untagged";
    topicCounts[tag] = (topicCounts[tag] || 0) + 1;
  });
  const topicData = Object.entries(topicCounts).map(([name, value]) => ({ name, value }));

  const stats = [
    { icon: Hash, label: "Questions", value: questions.length },
    { icon: FileText, label: "Total Marks", value: totalMarks },
    { icon: Clock, label: "Est. Time", value: `${estimatedMinutes} min` },
  ];

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center p-3 rounded-xl bg-card/60 border border-border">
            <s.icon className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-lg font-bold text-foreground">{s.value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Topic distribution chart */}
      {topicData.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Topic Distribution
          </p>
          <div className="h-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topicData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {topicData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {topicData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                {t.name} ({t.value})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
