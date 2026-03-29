import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { getRegionBoards, LEVEL_DISPLAY_NAMES, BOARD_LEVEL_MAP } from "@/lib/board-level-mapping";
import { getBoardDisplayName } from "@/lib/board-scrubber";
import { supabase } from "@/integrations/supabase/client";

const REGIONS = [
  { id: "GB", code: "UK", label: "United Kingdom" },
  { id: "US", code: "US", label: "United States" },
  { id: "IN", code: "IN", label: "India" },
  { id: "AU", code: "AU", label: "Australia" },
  { id: "IB", code: "IB", label: "International / IB" },
  { id: "IE", code: "IE", label: "Ireland" },
  { id: "NZ", code: "NZ", label: "New Zealand" },
  { id: "Other", code: "??", label: "Other" },
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  cursor: "pointer",
};

interface ProfileSetupStepProps {
  onComplete: () => void;
  defaultRegion?: string | null;
  defaultBoard?: string | null;
  defaultLevel?: string | null;
}

const ProfileSetupStep = ({ onComplete, defaultRegion, defaultBoard, defaultLevel }: ProfileSetupStepProps) => {
  const [region, setRegion] = useState(defaultRegion ?? "");
  const [board, setBoard] = useState(defaultBoard ?? "");
  const [level, setLevel] = useState(defaultLevel ?? "");
  const [customRegionText, setCustomRegionText] = useState("");
  const [customBoardText, setCustomBoardText] = useState("");
  const [customLevelText, setCustomLevelText] = useState("");
  const [saving, setSaving] = useState(false);

  const regionBoards = region
    ? getRegionBoards(region === "Other" ? "international" : region)
    : [];
  const boardLevels = board && board !== "other" ? (BOARD_LEVEL_MAP[board] ?? []) : [];

  const allFilled =
    !!region &&
    (region !== "Other" || !!customRegionText.trim()) &&
    !!board &&
    (board !== "other" || !!customBoardText.trim()) &&
    !!level &&
    (level !== "other" || !!customLevelText.trim());

  const handleSave = async () => {
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const regionValue = region === "Other" ? customRegionText || "Other" : region;
      const boardValue = board === "other" ? customBoardText : board;
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

      onComplete();
    } catch (err) {
      console.error("Error saving profile setup:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    // Save partial data before skipping
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && (region || board || level)) {
        const regionValue = region === "Other" ? customRegionText || null : region || null;
        const boardValue = board === "other" ? customBoardText || null : board || null;
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
    onComplete();
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
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          Set up your study profile
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          This helps us generate questions in exactly the right style for your exams.
        </p>
      </div>

      {/* Region */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>WHERE ARE YOU STUDYING?</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
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
                padding: "10px 14px",
                background: region === r.id ? "#1e3a5f" : "#0f172a",
                border: `1px solid ${region === r.id ? "#3b82f6" : "#334155"}`,
                borderRadius: 8,
                color: region === r.id ? "#93c5fd" : "#64748b",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: region === r.id ? "#3b82f6" : "#334155",
                  background: region === r.id ? "#1e3a5f" : "#1e293b",
                  border: `1px solid ${region === r.id ? "#3b82f6" : "#334155"}`,
                  borderRadius: 3,
                  padding: "1px 4px",
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}
              >
                {r.code}
              </span>
              {r.label}
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
            <select
              value={board}
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
                Not sure? Pick the one most of your subjects use.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level */}
      <AnimatePresence>
        {board && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 16 }}
          >
            <label style={labelStyle}>YOUR CURRENT LEVEL</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Board-specific levels */}
              {boardLevels.map((levelId) => (
                <motion.button
                  key={levelId}
                  onClick={() => setLevel(levelId)}
                  whileHover={{ scale: 1.01 }}
                  style={{
                    padding: "10px 14px",
                    background: level === levelId ? "#1e3a5f" : "#0f172a",
                    border: `1px solid ${level === levelId ? "#3b82f6" : "#334155"}`,
                    borderRadius: 8,
                    color: level === levelId ? "#93c5fd" : "#64748b",
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
              {!UNIVERSAL_LEVELS.some((u) => boardLevels.includes(u.id)) && (
                <>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#334155",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "6px 0 2px",
                    }}
                  >
                    Higher Education & Professional
                  </div>
                  {UNIVERSAL_LEVELS.map((opt) => (
                    <motion.button
                      key={opt.id}
                      onClick={() => setLevel(opt.id)}
                      whileHover={{ scale: 1.01 }}
                      style={{
                        padding: "10px 14px",
                        background: level === opt.id ? "#1e3a5f" : "#0f172a",
                        border: `1px solid ${level === opt.id ? "#3b82f6" : "#334155"}`,
                        borderRadius: 8,
                        color: level === opt.id ? "#93c5fd" : "#64748b",
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
                  background: level === "other" ? "#1e3a5f" : "#0f172a",
                  border: `1px solid ${level === "other" ? "#3b82f6" : "#334155"}`,
                  borderRadius: 8,
                  color: level === "other" ? "#93c5fd" : "#64748b",
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
              background: "#0f172a",
              borderRadius: 8,
              borderLeft: "3px solid #22c55e",
              fontSize: 12,
              color: "#64748b",
              marginBottom: 16,
            }}
          >
            <Check size={12} color="#22c55e" style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
            Questions will be generated in{" "}
            <strong style={{ color: "#86efac" }}>
              {getBoardDisplayName(board === "other" ? customBoardText : board)}{" "}
              {LEVEL_DISPLAY_NAMES[level] ?? customLevelText}
            </strong>{" "}
            style
          </motion.div>
        )}
      </AnimatePresence>

      {/* Continue */}
      <div style={{ paddingTop: 8 }}>
        <motion.button
          whileHover={{ scale: allFilled ? 1.02 : 1 }}
          whileTap={{ scale: allFilled ? 0.97 : 1 }}
          onClick={handleSave}
          disabled={!allFilled || saving}
          style={{
            width: "100%",
            padding: "12px",
            background: allFilled ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#1e293b",
            border: "none",
            borderRadius: 8,
            color: allFilled ? "white" : "#334155",
            fontSize: 14,
            fontWeight: 600,
            cursor: allFilled ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            marginBottom: 8,
          }}
        >
          {saving ? "Saving..." : "Continue →"}
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
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#475569")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#334155")}
        >
          Skip for now — I'll set this up in Settings
        </button>
      </div>
    </div>
  );
};

export default ProfileSetupStep;
