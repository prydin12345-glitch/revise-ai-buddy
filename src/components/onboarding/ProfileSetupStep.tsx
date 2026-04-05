import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { getRegionBoards, LEVEL_DISPLAY_NAMES, BOARD_LEVEL_MAP } from "@/lib/board-level-mapping";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { supabase } from "@/integrations/supabase/client";

const REGIONS = [
  { id: "GB", flag: "🇬🇧", label: "United Kingdom" },
  { id: "US", flag: "🇺🇸", label: "United States" },
  { id: "IN", flag: "🇮🇳", label: "India" },
  { id: "AU", flag: "🇦🇺", label: "Australia" },
  { id: "IB", flag: "🌐", label: "International / IB" },
  { id: "IE", flag: "🇮🇪", label: "Ireland" },
  { id: "NZ", flag: "🇳🇿", label: "New Zealand" },
  { id: "Other", flag: "🌍", label: "Other" },
];

const UNIVERSAL_LEVELS = [
  { id: "undergrad", label: "Undergraduate / Bachelor's" },
  { id: "postgrad", label: "Postgraduate / Master's" },
  { id: "doctoral", label: "Doctoral / PhD" },
  { id: "professional_cert", label: "Professional Certification" },
  { id: "cpd", label: "CPD / Continuing Development" },
  { id: "vocational_advanced", label: "Vocational — Advanced" },
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
};

interface ProfileSetupStepProps {
  onComplete: (data?: any) => void;
  onBack?: () => void;
  initialValues?: {
    region?: string;
    board?: string;
    level?: string;
    customRegionText?: string;
    customBoardText?: string;
    customLevelText?: string;
  } | null;
}

const ProfileSetupStep = ({ onComplete, onBack, initialValues }: ProfileSetupStepProps) => {
  const [region, setRegion] = useState(initialValues?.region ?? "");
  const [board, setBoard] = useState(initialValues?.board ?? "");
  const [level, setLevel] = useState(initialValues?.level ?? "");
  const [customRegionText, setCustomRegionText] = useState(initialValues?.customRegionText ?? "");
  const [customBoardText, setCustomBoardText] = useState(initialValues?.customBoardText ?? "");
  const [customLevelText, setCustomLevelText] = useState(initialValues?.customLevelText ?? "");
  const [saving, setSaving] = useState(false);

  const regionBoards = region
    ? getRegionBoards(region === "Other" ? "international" : region)
    : [];
  const boardLevels = board && board !== "other" && board !== "none" ? (BOARD_LEVEL_MAP[board] ?? []) : [];

  const hasBoard = !!board && (board !== "other" || !!customBoardText.trim());
  const hasLevel = !!level && (level !== "other" || !!customLevelText.trim());
  const allFilled =
    !!region &&
    (region !== "Other" || !!customRegionText.trim()) &&
    hasBoard &&
    hasLevel;

  const getCurrentData = () => ({
    region,
    board,
    level,
    customRegionText,
    customBoardText,
    customLevelText,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const regionValue = region === "Other" ? customRegionText || "Other" : region;
      const boardValue = board === "none" ? null : board === "other" ? customBoardText : board;
      const levelValue = level === "other" ? customLevelText : level;

      const { error: prefError } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          curriculum_region: regionValue,
          preferred_exam_board: boardValue,
          preferred_educational_level: levelValue,
        },
        { onConflict: "user_id" }
      );

      if (prefError) console.error("Error saving preferences:", prefError);

      await supabase.from("user_onboarding_status").upsert(
        {
          user_id: user.id,
          role: "student",
          profile_completed: true,
          last_step: "profile",
        },
        { onConflict: "user_id,role" }
      );

      onComplete(getCurrentData());
    } catch (err) {
      console.error("Error saving profile setup:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (region || board || level)) {
        const regionValue = region === "Other" ? customRegionText || null : region || null;
        const boardValue = board === "none" ? null : board === "other" ? customBoardText || null : board || null;
        const levelValue = level === "other" ? customLevelText || null : level || null;

        await supabase.from("user_preferences").upsert(
          {
            user_id: user.id,
            curriculum_region: regionValue,
            preferred_exam_board: boardValue,
            preferred_educational_level: levelValue,
          },
          { onConflict: "user_id" }
        );
      }
    } catch (err) {
      console.error("Error saving partial profile:", err);
    }
    onComplete(getCurrentData());
  };

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
          Step 2 of 3
        </div>
        <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          Set up your study profile
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          This helps us generate questions in exactly the right style for your exams.
        </p>
      </div>

      {/* Region */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>WHERE ARE YOU STUDYING?</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "clamp(6px, 2vw, 8px)" }}>
          {REGIONS.map((r) => (
            <motion.button
              key={r.id}
              onClick={() => {
                setRegion(r.id);
                setBoard("");
                setLevel("");
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px)",
                background: region === r.id ? "#eff6ff" : "#f8fafc",
                border: `1px solid ${region === r.id ? "#3b82f6" : "#e2e8f0"}`,
                borderRadius: 8,
                color: region === r.id ? "#2563eb" : "#64748b",
                fontSize: "clamp(12px, 3vw, 13px)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 18, lineHeight: 1 }}>{r.flag}</span>
              <span>{r.label}</span>
              {region === r.id && (
                <Check size={12} color="#3b82f6" strokeWidth={2.5} style={{ marginLeft: "auto" }} />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Custom region text for "Other" */}
      <AnimatePresence>
        {region === "Other" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: 16 }}
          >
            <label style={labelStyle}>YOUR COUNTRY OR REGION</label>
            <input
              type="text"
              placeholder="e.g. South Africa, Singapore, Canada..."
              value={customRegionText}
              onChange={(e) => setCustomRegionText(e.target.value)}
              style={inputStyle}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Board — shows for ALL regions */}
      <AnimatePresence>
        {region && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 16 }}
          >
            <label style={labelStyle}>EXAM BOARD</label>

            {/* No exam board option */}
            <motion.button
              onClick={() => { setBoard("none"); setLevel(""); }}
              whileHover={{ scale: 1.01 }}
              style={{
                width: "100%",
                padding: "10px 14px",
                background: board === "none" ? "#f0fdf4" : "#f8fafc",
                border: `1px solid ${board === "none" ? "#22c55e" : "#e2e8f0"}`,
                borderRadius: 8,
                color: board === "none" ? "#16a34a" : "#64748b",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
                transition: "all 0.15s",
              }}
            >
              <span style={{ fontSize: 16 }}>—</span>
              <div>
                <div style={{ fontWeight: 500 }}>No exam board / Not sure</div>
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>
                  Questions will use general academic style for your level
                </div>
              </div>
              {board === "none" && (
                <Check size={12} color="#22c55e" strokeWidth={2.5} style={{ marginLeft: "auto" }} />
              )}
            </motion.button>

            <select
              value={board === "none" ? "" : board}
              onChange={(e) => {
                setBoard(e.target.value);
                setLevel("");
              }}
              style={selectStyle}
            >
              <option value="">Select your exam board...</option>
              {regionBoards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {!regionBoards.some((b) => b.id === "other") && (
                <option value="other">Other / Not listed</option>
              )}
            </select>

            {board === "other" && (
              <motion.input
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                type="text"
                placeholder="Enter your exam board name..."
                value={customBoardText}
                onChange={(e) => setCustomBoardText(e.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
              />
            )}

            {!board && (
              <p style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                Not sure? Pick the one most of your subjects use, or select "No exam board".
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level — shows when board is selected (including 'none') */}
      <AnimatePresence>
        {board && board !== "" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 16 }}
          >
            <label style={labelStyle}>YOUR CURRENT LEVEL</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Board-specific levels (not shown for 'none') */}
              {board !== "none" && boardLevels.map((levelId) => (
                <motion.button
                  key={levelId}
                  onClick={() => setLevel(levelId)}
                  whileHover={{ scale: 1.01 }}
                  style={{
                    padding: "10px 14px",
                    background: level === levelId ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${level === levelId ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: 8,
                    color: level === levelId ? "#2563eb" : "#64748b",
                    fontSize: 13,
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  {LEVEL_DISPLAY_NAMES[levelId] ?? levelId}
                </motion.button>
              ))}

              {/* Universal higher ed levels */}
              {(board === "none" || !UNIVERSAL_LEVELS.some((u) => boardLevels.includes(u.id))) && (
                <>
                  {board !== "none" && boardLevels.length > 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#e2e8f0",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        padding: "6px 0 2px",
                      }}
                    >
                      Higher Education & Professional
                    </div>
                  )}
                  {UNIVERSAL_LEVELS.map((opt) => (
                    <motion.button
                      key={opt.id}
                      onClick={() => setLevel(opt.id)}
                      whileHover={{ scale: 1.01 }}
                      style={{
                        padding: "10px 14px",
                        background: level === opt.id ? "#eff6ff" : "#f8fafc",
                        border: `1px solid ${level === opt.id ? "#3b82f6" : "#e2e8f0"}`,
                        borderRadius: 8,
                        color: level === opt.id ? "#2563eb" : "#64748b",
                        fontSize: 13,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "inherit",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt.label}
                    </motion.button>
                  ))}
                </>
              )}

              {/* Other free text */}
              <motion.button
                onClick={() => setLevel("other")}
                whileHover={{ scale: 1.01 }}
                style={{
                  padding: "10px 14px",
                  background: level === "other" ? "#eff6ff" : "#f8fafc",
                  border: `1px solid ${level === "other" ? "#3b82f6" : "#e2e8f0"}`,
                  borderRadius: 8,
                  color: level === "other" ? "#2563eb" : "#64748b",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                Other — specify below
              </motion.button>

              {level === "other" && (
                <motion.input
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  type="text"
                  placeholder="e.g. HNC, NVQ Level 3, Foundation Year..."
                  value={customLevelText}
                  onChange={(e) => setCustomLevelText(e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation preview */}
      <AnimatePresence>
        {allFilled && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              padding: "10px 14px",
              background: "#f8fafc",
              borderRadius: 8,
              borderLeft: "3px solid #22c55e",
              fontSize: 12,
              color: "#64748b",
              marginBottom: 16,
            }}
          >
            <Check size={12} color="#22c55e" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            Questions will be generated in{" "}
            <strong style={{ color: "#16a34a" }}>
              {board === "none"
                ? "general academic"
                : getBoardDisplayName(board === "other" ? customBoardText : board)}{" "}
              {LEVEL_DISPLAY_NAMES[level] ?? customLevelText}
            </strong>{" "}
            style
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue + Back */}
      <div style={{ paddingTop: 8 }}>
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
            whileHover={{ scale: allFilled ? 1.02 : 1 }}
            whileTap={{ scale: allFilled ? 0.97 : 1 }}
            onClick={handleSave}
            disabled={!allFilled || saving}
            style={{
              flex: 1,
              padding: "12px",
              background: allFilled ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#ffffff",
              border: "none",
              borderRadius: 8,
              color: allFilled ? "white" : "#e2e8f0",
              fontSize: 14,
              fontWeight: 600,
              cursor: allFilled ? "pointer" : "not-allowed",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Saving..." : "Continue →"}
          </motion.button>
        </div>

        <button
          onClick={handleSkip}
          style={{
            width: "100%",
            padding: "8px",
            background: "none",
            border: "none",
            color: "#e2e8f0",
            fontSize: 12,
            cursor: "pointer",
            fontFamily: "inherit",
            marginTop: 8,
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#e2e8f0")}
        >
          Skip for now — I'll set this up in Settings
        </button>
      </div>
    </div>
  );
};

export default ProfileSetupStep;
