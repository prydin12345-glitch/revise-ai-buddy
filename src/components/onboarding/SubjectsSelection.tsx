import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Check } from "lucide-react";
import { Subject, UserSubject } from "@/hooks/useSubjects";

interface SubjectsSelectionProps {
  subjects: Subject[];
  onComplete: (selected: UserSubject[]) => void;
}

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "sciences", label: "Sciences" },
  { id: "maths", label: "Mathematics" },
  { id: "languages", label: "Languages" },
  { id: "humanities", label: "Humanities" },
  { id: "other", label: "Other" },
];

const CURRICULUM_TAGS = ["GCSE", "A-Level", "IB Diploma", "AP", "BTEC", "Professional Certification", "University / Degree", "Other"];

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

const getSubjectColor = (category: string) => {
  const colors: Record<string, string> = {
    sciences: "#10b981",
    maths: "#3b82f6",
    languages: "#8b5cf6",
    humanities: "#f59e0b",
    other: "#6b7280",
  };
  return colors[category] || "#6b7280";
};

const SubjectsSelection = ({ subjects, onComplete }: SubjectsSelectionProps) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<UserSubject[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customCurriculum, setCustomCurriculum] = useState("");

  const filteredSubjects = subjects.filter((s) => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleSubject = (subject: Subject) => {
    const exists = selectedSubjects.find((s) => s.subject_id === subject.id);
    if (exists) {
      setSelectedSubjects(selectedSubjects.filter((s) => s.subject_id !== subject.id));
    } else {
      setSelectedSubjects([
        ...selectedSubjects,
        {
          subject_id: subject.id,
          subject_name: subject.name,
          subject_color: getSubjectColor(subject.category),
          is_custom: false,
          user_id: "",
        },
      ]);
    }
  };

  const addCustomSubject = () => {
    if (!customSubjectName.trim()) return;
    const newSubject: UserSubject = {
      subject_name: customSubjectName.trim(),
      custom_name: customSubjectName.trim(),
      curriculum_tag: customCurriculum || undefined,
      subject_color: getSubjectColor("other"),
      is_custom: true,
      user_id: "",
      subject_id: undefined,
    };
    setSelectedSubjects([...selectedSubjects, newSubject]);
    setCustomSubjectName("");
    setCustomCurriculum("");
    setShowCustomModal(false);
  };

  const handleContinue = () => {
    if (selectedSubjects.length === 0) return;
    const invalidSubjects = selectedSubjects.filter((s) => {
      if (!s.is_custom && !s.subject_id) return true;
      return false;
    });
    if (invalidSubjects.length > 0) return;
    onComplete(selectedSubjects);
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
          Step 1 of 3
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
          What are you studying?
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Select your subjects. You can add more later.</p>
      </div>

      {/* Category filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            style={{
              padding: "5px 12px",
              borderRadius: 99,
              border: `1px solid ${selectedCategory === cat.id ? "#3b82f6" : "#334155"}`,
              background: selectedCategory === cat.id ? "#1e3a5f" : "transparent",
              color: selectedCategory === cat.id ? "#93c5fd" : "#64748b",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <Search
          size={14}
          color="#475569"
          style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
        />
        <input
          type="text"
          placeholder="Search subjects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 34 }}
        />
      </div>

      {/* Subject grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 8,
          maxHeight: 280,
          overflowY: "auto",
          marginBottom: 16,
          paddingRight: 4,
        }}
      >
        {filteredSubjects.map((subject) => {
          const isSelected = selectedSubjects.some((s) => s.subject_id === subject.id);
          return (
            <motion.button
              key={subject.id}
              onClick={() => toggleSubject(subject)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              style={{
                padding: "10px 12px",
                background: isSelected ? "#1e3a5f" : "#0f172a",
                border: `1px solid ${isSelected ? "#3b82f6" : "#334155"}`,
                borderRadius: 8,
                color: isSelected ? "#93c5fd" : "#64748b",
                fontSize: 13,
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {subject.name}
              </span>
              {isSelected && <Check size={12} color="#3b82f6" strokeWidth={2.5} />}
            </motion.button>
          );
        })}
      </div>

      {/* Add custom */}
      <button
        onClick={() => setShowCustomModal(true)}
        style={{
          width: "100%",
          padding: "10px",
          background: "transparent",
          border: "1px dashed #334155",
          borderRadius: 8,
          color: "#475569",
          fontSize: 13,
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginBottom: 20,
          transition: "border-color 0.15s, color 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#3b82f6";
          e.currentTarget.style.color = "#3b82f6";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#334155";
          e.currentTarget.style.color = "#475569";
        }}
      >
        <Plus size={14} />
        Add a custom subject
      </button>

      {/* Selected chips */}
      {selectedSubjects.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {selectedSubjects.map((s, idx) => (
            <span
              key={idx}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px",
                borderRadius: 99,
                background: "#1e3a5f",
                border: "1px solid rgba(59,130,246,0.3)",
                fontSize: 12,
                color: "#93c5fd",
              }}
            >
              {s.custom_name || s.subject_name}
              {s.curriculum_tag && <span style={{ opacity: 0.6, fontSize: 10 }}>({s.curriculum_tag})</span>}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#475569" }}>
          {selectedSubjects.length > 0
            ? `${selectedSubjects.length} subject${selectedSubjects.length > 1 ? "s" : ""} selected`
            : "Select at least one subject"}
        </span>
        <motion.button
          whileHover={{ scale: selectedSubjects.length > 0 ? 1.02 : 1 }}
          whileTap={{ scale: selectedSubjects.length > 0 ? 0.97 : 1 }}
          onClick={handleContinue}
          disabled={selectedSubjects.length === 0}
          style={{
            padding: "10px 24px",
            background: selectedSubjects.length > 0 ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#1e293b",
            border: "none",
            borderRadius: 8,
            color: selectedSubjects.length > 0 ? "white" : "#334155",
            fontSize: 14,
            fontWeight: 600,
            cursor: selectedSubjects.length > 0 ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            transition: "all 0.2s",
          }}
        >
          Continue →
        </motion.button>
      </div>

      {/* Custom Subject Modal */}
      <AnimatePresence>
        {showCustomModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCustomModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 14,
                padding: "28px 24px",
                width: "100%",
                maxWidth: 400,
              }}
            >
              <h3 style={{ fontSize: 17, fontWeight: 700, color: "#f1f5f9", margin: "0 0 20px" }}>
                Add custom subject
              </h3>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>SUBJECT NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Music Theory, Economics..."
                  value={customSubjectName}
                  onChange={(e) => setCustomSubjectName(e.target.value)}
                  style={inputStyle}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>QUALIFICATION (OPTIONAL)</label>
                <select
                  value={customCurriculum}
                  onChange={(e) => setCustomCurriculum(e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Select if applicable...</option>
                  {CURRICULUM_TAGS.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowCustomModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "transparent",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    color: "#64748b",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={addCustomSubject}
                  disabled={!customSubjectName.trim()}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: customSubjectName.trim()
                      ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                      : "#1e293b",
                    border: "none",
                    borderRadius: 8,
                    color: customSubjectName.trim() ? "white" : "#334155",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: customSubjectName.trim() ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  Add Subject
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubjectsSelection;
