import { useState } from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, BookOpen, Heart, BarChart2, PenTool, Check } from "lucide-react";

interface GoalFormData {
  goal_type: string;
  custom_goal_text?: string;
  target_metric: {
    score?: number;
    count?: number;
    unit?: string;
  };
  deadline?: string;
  effort_estimate?: number;
  auto_schedule: boolean;
  subject: string;
  subject_color: string;
}

interface GoalsFormProps {
  subjects: Array<{ subject_name?: string; custom_name?: string; subject_color: string }>;
  onComplete: (goals: GoalFormData[]) => void;
  onBack?: () => void;
  initialValues?: {
    selectedGoalTypes?: string[];
    targetScore?: number;
    effortHours?: number;
    deadline?: string;
    customGoalText?: string;
    selectedSubject?: string;
    selectedColor?: string;
  } | null;
}

const GOAL_TYPES = [
  { id: "improve_grade", label: "Improve Grade", icon: TrendingUp },
  { id: "build_confidence", label: "Build Confidence", icon: Heart },
  { id: "exam_techniques", label: "Exam Techniques", icon: BookOpen },
  { id: "reduce_stress", label: "Reduce Stress", icon: Target },
  { id: "track_progress", label: "Track Progress", icon: BarChart2 },
  { id: "custom", label: "Custom Goal", icon: PenTool },
];

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#475569",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  color: "#0f172a",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const GoalsForm = ({ subjects, onComplete, onBack, initialValues }: GoalsFormProps) => {
  const defaultSubject =
    subjects.length > 0 ? subjects[0]?.subject_name || subjects[0]?.custom_name || "" : "";
  const defaultColor = subjects.length > 0 ? subjects[0]?.subject_color || "#3b82f6" : "#3b82f6";

  const [selectedGoalTypes, setSelectedGoalTypes] = useState<string[]>(
    initialValues?.selectedGoalTypes ?? ["improve_grade"]
  );
  const [targetScore, setTargetScore] = useState(initialValues?.targetScore ?? 80);
  const [effortHours, setEffortHours] = useState(initialValues?.effortHours ?? 5);
  const [deadline, setDeadline] = useState(initialValues?.deadline ?? "");
  const [customGoalText, setCustomGoalText] = useState(initialValues?.customGoalText ?? "");
  const [selectedSubject, setSelectedSubject] = useState(initialValues?.selectedSubject ?? defaultSubject);
  const [selectedColor, setSelectedColor] = useState(initialValues?.selectedColor ?? defaultColor);

  const toggleGoalType = (id: string) => {
    setSelectedGoalTypes((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleComplete = () => {
    const goals: GoalFormData[] = selectedGoalTypes.map((goalType) => ({
      goal_type: goalType,
      custom_goal_text: goalType === "custom" ? customGoalText : undefined,
      target_metric:
        goalType === "improve_grade"
          ? { score: targetScore, unit: "%" }
          : { count: 10, unit: "sessions" },
      deadline: deadline || undefined,
      effort_estimate: effortHours,
      auto_schedule: false,
      subject: selectedSubject,
      subject_color: selectedColor,
    }));
    onComplete(goals);
  };

  const handleSkip = () => {
    const goal: GoalFormData = {
      goal_type: "improve_grade",
      target_metric: { score: 80, unit: "%" },
      effort_estimate: 5,
      auto_schedule: false,
      subject: defaultSubject,
      subject_color: defaultColor,
    };
    onComplete([goal]);
  };

  if (subjects.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px 20px", color: "#475569", fontSize: 13 }}>
        No subjects selected. Please go back and select your subjects first.
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            color: "#3b82f6",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          Step 3 of 3
        </div>
        <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          Set your goals
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          Tell us what you want to achieve. You can update these any time.
        </p>
      </div>

      {/* Subject selector (if multiple) */}
      {subjects.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>SUBJECT</label>
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              const sub = subjects.find(
                (s) => (s.subject_name || s.custom_name) === e.target.value
              );
              setSelectedColor(sub?.subject_color || "#3b82f6");
            }}
            style={{
              ...inputStyle,
              appearance: "none" as const,
              cursor: "pointer",
            }}
          >
            {subjects.map((s, idx) => (
              <option key={idx} value={s.subject_name || s.custom_name || ""}>
                {s.subject_name || s.custom_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Goal type — multi-select */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>WHAT ARE YOUR GOALS?</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 8 }}>
          {GOAL_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedGoalTypes.includes(type.id);
            return (
              <motion.button
                key={type.id}
                onClick={() => toggleGoalType(type.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "clamp(8px, 2vw, 12px) clamp(10px, 2.5vw, 14px)",
                  background: isSelected ? "#eff6ff" : "#f8fafc",
                  border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                  borderRadius: 8,
                  color: isSelected ? "#2563eb" : "#64748b",
                  fontSize: "clamp(11px, 2.5vw, 12px)",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Icon size={14} />
                  {type.label}
                </div>
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    border: `2px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                    background: isSelected ? "#3b82f6" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.15s",
                  }}
                >
                  {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                </div>
              </motion.button>
            );
          })}
        </div>
        {selectedGoalTypes.length > 0 && (
          <div style={{ fontSize: 11, color: "#475569", marginTop: 6 }}>
            {selectedGoalTypes.length} goal{selectedGoalTypes.length > 1 ? "s" : ""} selected
          </div>
        )}
      </div>

      {/* Custom goal text */}
      {selectedGoalTypes.includes("custom") && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>DESCRIBE YOUR GOAL</label>
          <input
            type="text"
            placeholder="What do you want to achieve?"
            value={customGoalText}
            onChange={(e) => setCustomGoalText(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {/* Target score */}
      {selectedGoalTypes.includes("improve_grade") && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>TARGET SCORE</label>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{targetScore}%</span>
          </div>
          <input
            type="range"
            min={40}
            max={100}
            step={5}
            value={targetScore}
            onChange={(e) => setTargetScore(Number(e.target.value))}
            style={{ width: "100%", accentColor: "#3b82f6" }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: "#94a3b8",
              marginTop: 2,
            }}
          >
            <span>40%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Effort */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>HOURS PER WEEK</label>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#3b82f6" }}>{effortHours}h</span>
        </div>
        <input
          type="range"
          min={1}
          max={20}
          value={effortHours}
          onChange={(e) => setEffortHours(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#3b82f6" }}
        />
      </div>

      {/* Deadline */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>EXAM DATE (OPTIONAL)</label>
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          style={{ ...inputStyle, colorScheme: "light" }}
        />
      </div>

      {/* Continue + Back */}
      <div style={{ display: "flex", gap: 10 }}>
        {onBack && (
          <button
            onClick={() => onBack()}
            style={{
              flex: "0 0 auto",
              padding: "10px 20px",
              background: "transparent",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              color: "#64748b",
              fontSize: 14,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#475569";
              e.currentTarget.style.color = "#94a3b8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e2e8f0";
              e.currentTarget.style.color = "#64748b";
            }}
          >
            ← Back
          </button>
        )}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleComplete}
          disabled={selectedGoalTypes.length === 0}
          style={{
            flex: 1,
            padding: "13px",
            background:
              selectedGoalTypes.length > 0
                ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                : "#ffffff",
            border: "none",
            borderRadius: 8,
            color: selectedGoalTypes.length > 0 ? "white" : "#cbd5e1",
            fontSize: 15,
            fontWeight: 700,
            cursor: selectedGoalTypes.length > 0 ? "pointer" : "not-allowed",
            fontFamily: "inherit",
          }}
        >
          Start Practising →
        </motion.button>
      </div>

      <button
        onClick={handleSkip}
        style={{
          width: "100%",
          padding: "8px",
          background: "none",
          border: "none",
          color: "#94a3b8",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 8,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
      >
        Skip — I'll set goals later
      </button>
    </div>
  );
};

export default GoalsForm;
