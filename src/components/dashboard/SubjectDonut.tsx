import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import type { ExamWithSubmission } from "./ExamRowItem";

interface Subject {
  id: string;
  subject_name: string;
}

interface Props {
  exams: ExamWithSubmission[];
  subjects: Subject[];
  getSubjectColor: (id: string) => string;
  overallAverage: number | null;
}

interface Slice {
  id: string;
  name: string;
  value: number;
  count: number;
  color: string;
}

export const SubjectDonut = ({ exams, subjects, getSubjectColor, overallAverage }: Props) => {
  const data = useMemo<Slice[]>(() => {
    const bySubject = new Map<string, { sum: number; count: number }>();
    exams.forEach((e) => {
      const s = e.submission;
      if (!s || s.status !== "graded" || !s.total_marks || s.total_marks <= 0) return;
      const pct = (s.total_score / s.total_marks) * 100;
      const id = e.subject_id;
      const cur = bySubject.get(id) ?? { sum: 0, count: 0 };
      cur.sum += pct;
      cur.count += 1;
      bySubject.set(id, cur);
    });

    return Array.from(bySubject.entries()).map(([id, v]) => {
      const subjectName = subjects.find((s) => s.id === id)?.subject_name ?? id;
      return {
        id,
        name: subjectName,
        value: Math.round(v.sum / v.count),
        count: v.count,
        color: getSubjectColor(id),
      };
    });
  }, [exams, subjects, getSubjectColor]);

  if (data.length === 0) {
    return (
      <div className="p-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-3 font-semibold">
          Subject statistics
        </p>
        <div className="flex flex-col items-center justify-center text-center py-6 text-muted-foreground">
          <PieIcon size={28} className="opacity-40 mb-2" />
          <p className="text-xs">Complete an exam to see your subject breakdown.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">
          Subject statistics
        </p>
        <span className="text-[10px] text-muted-foreground">avg per subject</span>
      </div>

      <div className="relative" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              stroke="hsl(var(--card))"
              strokeWidth={2}
            >
              {data.map((slice) => (
                <Cell key={slice.id} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
                padding: "6px 10px",
              }}
              formatter={(value: number, _name: string, item: any) => {
                const count = item?.payload?.count ?? 0;
                return [`${value}% (${count} exam${count === 1 ? "" : "s"})`, item?.payload?.name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-foreground leading-none">
            {overallAverage !== null ? `${overallAverage}%` : "—"}
          </span>
          <span className="text-[10px] text-muted-foreground mt-1">overall avg</span>
        </div>
      </div>

      <div className="mt-3 space-y-1">
        {data.map((slice) => (
          <div key={slice.id} className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: slice.color }} />
              <span className="truncate text-foreground">{slice.name}</span>
            </div>
            <span className="font-semibold text-foreground shrink-0 ml-2">{slice.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};
