import { useState } from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, BookOpen, Heart, BarChart2, PenTool } from "lucide-react";

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
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  color: "#f1f5f9",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box" as const,
  fontFamily: "inherit",
  transition: "border-color 0.15s",
};

const GoalsForm = ({ subjects, onComplete }: GoalsFormProps) => {
  const defaultSubject =
    subjects.length > 0 ? subjects[0]?.subject_name || subjects[0]?.custom_name || "" : "";
  const defaultColor = subjects.length > 0 ? subjects[0]?.subject_color || "#3b82f6" : "#3b82f6";

  const [goalType, setGoalType] = useState("improve_grade");
  const [targetScore, setTargetScore] = useState(80);
  const [effortHours, setEffortHours] = useState(5);
  const [deadline, setDeadline] = useState("");
  const [customGoalText, setCustomGoalText] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(defaultSubject);
  const [selectedColor, setSelectedColor] = useState(defaultColor);

  const handleComplete = () => {
    const goal: GoalFormData = {
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
    };
    onComplete([goal]);
  };

  const handleSkip = () => {
    // Create a minimal goal so onComplete still works
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
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

      {/* Goal type */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>WHAT'S YOUR MAIN GOAL?</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 8 }}>
          {GOAL_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <motion.button
                key={type.id}
                onClick={() => setGoalType(type.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  padding: "12px 14px",
                  background: goalType === type.id ? "#1e3a5f" : "#0f172a",
                  border: `1px solid ${goalType === type.id ? "#3b82f6" : "#334155"}`,
                  borderRadius: 8,
                  color: goalType === type.id ? "#93c5fd" : "#64748b",
                  fontSize: 12,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Icon size={14} />
                {type.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Custom goal text */}
      {goalType === "custom" && (
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
      {goalType === "improve_grade" && (
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
              color: "#334155",
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
          style={{ ...inputStyle, colorScheme: "dark" }}
        />
      </div>

      {/* Complete */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={handleComplete}
        style={{
          width: "100%",
          padding: "13px",
          background: "linear-gradient(135deg, #3b82f6, #2563eb)",
          border: "none",
          borderRadius: 8,
          color: "white",
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Start Practising →
      </motion.button>

      <button
        onClick={handleSkip}
        style={{
          width: "100%",
          padding: "8px",
          background: "none",
          border: "none",
          color: "#334155",
          fontSize: 12,
          cursor: "pointer",
          fontFamily: "inherit",
          marginTop: 8,
          transition: "color 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
      >
        Skip — I'll set goals later
      </button>
    </div>
  );
};

export default GoalsForm;
