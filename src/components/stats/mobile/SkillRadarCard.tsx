import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts";
import { Radar as RadarIcon } from "lucide-react";
import { useTelemetry, truncate } from "./tokens";

interface Props {
  subjects: { name: string; avgScore: number }[];
}

export const SkillRadarCard = ({ subjects }: Props) => {
  const TELEMETRY = useTelemetry();
  const top = subjects.slice(0, 6).map((s) => ({
    axis: truncate(s.name, 12),
    score: Math.round(Math.max(0, Math.min(100, s.avgScore))),
  }));

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: TELEMETRY.card, border: `1px solid ${TELEMETRY.border}` }}
    >
      <div className="flex items-center gap-2 mb-1">
        <RadarIcon size={14} style={{ color: TELEMETRY.lime }} />
        <div className="text-sm font-semibold" style={{ color: TELEMETRY.text }}>
          Skill Balance
        </div>
      </div>
      <div className="text-[11px] mb-2" style={{ color: TELEMETRY.muted }}>
        Performance across subjects
      </div>

      {top.length < 3 ? (
        <div className="h-[220px] flex items-center justify-center text-xs text-center px-6" style={{ color: TELEMETRY.muted }}>
          Complete exams in 3+ subjects to reveal your skill balance
        </div>
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={top} outerRadius="65%">
              <PolarGrid stroke={TELEMETRY.border} />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: TELEMETRY.muted, fontSize: 10 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                dataKey="score"
                stroke={TELEMETRY.lime}
                strokeWidth={2}
                fill={TELEMETRY.lime}
                fillOpacity={0.2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
