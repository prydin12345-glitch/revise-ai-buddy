import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Plus, Search } from "lucide-react";
import { Subject } from "@/hooks/useSubjects";
import { getRegionBoards } from "@/lib/board-level-mapping";
import { useTutorOnboarding, TutorProfile } from "@/hooks/useTutorOnboarding";

interface TutorOnboardingProps {
  subjects: Subject[];
  onComplete: () => void;
  currentStep: number;
  onStepChange: (step: number) => void;
}

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

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "sciences", label: "Sciences" },
  { id: "maths", label: "Mathematics" },
  { id: "languages", label: "Languages" },
  { id: "humanities", label: "Humanities" },
  { id: "other", label: "Other" },
];

const ALL_LEVELS = [
  { id: "ks3", label: "KS3 / Middle School (Age 11–14)" },
  { id: "level2_gcse", label: "GCSE / Level 2 (Age 14–16)" },
  { id: "level3_a_level", label: "A-Level / Level 3 (Age 16–18)" },
  { id: "ib_diploma", label: "IB Diploma" },
  { id: "ap", label: "AP (Advanced Placement)" },
  { id: "undergrad", label: "Undergraduate / University" },
  { id: "postgrad", label: "Postgraduate / Masters" },
  { id: "professional_cert", label: "Professional Certification" },
  { id: "vocational", label: "Vocational / Apprenticeship" },
  { id: "other_level", label: "Other" },
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

interface ClassEntry {
  id: string;
  name: string;
  studentCount: string;
}

const TutorOnboarding = ({ subjects, onComplete, currentStep, onStepChange }: TutorOnboardingProps) => {
  const { completeTutorOnboarding, loading: isSubmitting } = useTutorOnboarding();

  // Step 1 state
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Step 2 state
  const [region, setRegion] = useState("");
  const [customRegionText, setCustomRegionText] = useState("");
  const [selectedBoards, setSelectedBoards] = useState<string[]>([]);
  const [customBoardText, setCustomBoardText] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);

  // Step 3 state
  const [teachingMode, setTeachingMode] = useState("groups");
  const [classes, setClasses] = useState<ClassEntry[]>([]);
  const [showClassError, setShowClassError] = useState(false);

  // Step 4 state
  const [bio, setBio] = useState("");
  const [availability, setAvailability] = useState<Record<string, boolean>>({});

  // Groups modal
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [createdGroups, setCreatedGroups] = useState<any[]>([]);

  const handleBack = () => onStepChange(Math.max(1, currentStep - 1));

  const toggleSubject = (id: string) => {
    setSelectedSubjects(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const addClass = () => {
    setClasses(prev => [...prev, { id: Math.random().toString(36).slice(2), name: "", studentCount: "" }]);
  };
  const updateClass = (id: string, field: string, value: string) => {
    setClasses(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  const removeClass = (id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
  };

  const filteredSubjects = subjects.filter(s => {
    const matchesSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "all" || s.category?.toLowerCase() === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const regionBoards = region
    ? getRegionBoards(region === "Other" ? "international" : region)
    : [];

  const handleComplete = async () => {
    const availabilityMap: Record<string, string[]> = {};
    Object.entries(availability).forEach(([day, selected]) => {
      if (selected) availabilityMap[day] = ["available"];
    });

    const totalStudents = classes.reduce((sum, c) => sum + (parseInt(c.studentCount) || 0), 0);
    const avgSize = classes.length > 0
      ? Math.ceil(totalStudents / classes.length)
      : undefined;

    const profile: TutorProfile = {
      subjects_taught: selectedSubjects,
      teaching_mode: teachingMode as any,
      student_count_estimate: totalStudents || undefined,
      preferred_group_size: avgSize,
      availability: availabilityMap,
      bio: bio.trim() || undefined,
    };

    // Pass extra data for named classes and profile fields
    const result = await completeTutorOnboarding({
      ...profile,
      teaching_region: region === "Other" ? customRegionText : region,
      custom_region: region === "Other" ? customRegionText : undefined,
      boards_taught: selectedBoards.filter(b => b !== "none"),
      levels_taught: selectedLevels,
      classes: classes.filter(c => c.name.trim()).map(c => ({
        name: c.name.trim(),
        studentCount: parseInt(c.studentCount) || null,
      })),
    } as any);

    if (result.success && result.groups && result.groups.length > 0) {
      setCreatedGroups(result.groups);
      setShowGroupsModal(true);
    } else if (result.success) {
      onComplete();
    }
  };

  const handleStep3Continue = () => {
    const unnamedClasses = classes.filter(c => !c.name.trim());
    if (unnamedClasses.length > 0) {
      setShowClassError(true);
      return;
    }
    setShowClassError(false);
    onStepChange(4);
  };

  return (
    <>
      {currentStep === 1 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              Step 1 of 4
            </div>
            <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              What do you teach?
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Select all subjects you teach. You can add custom subjects too.
            </p>
          </div>

          {/* Search */}
          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569" }} />
            <input
              type="text"
              placeholder="Search subjects..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 34 }}
            />
          </div>

          {/* Categories */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{
                  padding: "5px 12px", borderRadius: 99,
                  border: `1px solid ${activeCategory === cat.id ? "#3b82f6" : "#e2e8f0"}`,
                  background: activeCategory === cat.id ? "#eff6ff" : "transparent",
                  color: activeCategory === cat.id ? "#2563eb" : "#64748b",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Subject grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(clamp(100px, 30vw, 140px), 1fr))", gap: 8, maxHeight: 280, overflowY: "auto", marginBottom: 16 }}>
            {filteredSubjects.map(subject => {
              const isSelected = selectedSubjects.includes(subject.id);
              return (
                <motion.button
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: "10px 12px", background: isSelected ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: 8, color: isSelected ? "#2563eb" : "#64748b",
                    fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subject.name}</span>
                  {isSelected && <Check size={12} color="#3b82f6" strokeWidth={2.5} />}
                </motion.button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>
              {selectedSubjects.length > 0
                ? `${selectedSubjects.length} subject${selectedSubjects.length > 1 ? "s" : ""} selected`
                : "Select at least one subject"}
            </span>
            <motion.button
              whileHover={{ scale: selectedSubjects.length > 0 ? 1.02 : 1 }}
              whileTap={{ scale: selectedSubjects.length > 0 ? 0.97 : 1 }}
              onClick={() => onStepChange(2)}
              disabled={selectedSubjects.length === 0}
              style={{
                padding: "10px 24px",
                background: selectedSubjects.length > 0 ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "#ffffff",
                border: "none", borderRadius: 8,
                color: selectedSubjects.length > 0 ? "white" : "#e2e8f0",
                fontSize: 14, fontWeight: 600,
                cursor: selectedSubjects.length > 0 ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              Continue →
            </motion.button>
          </div>
        </div>
      )}

      {currentStep === 2 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              Step 2 of 4
            </div>
            <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Your teaching profile
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Tell us where and what level you teach. This helps generate the right style of questions for your students.
            </p>
          </div>

          {/* Region */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>WHERE DO YOU TEACH?</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "clamp(6px, 2vw, 8px)", marginTop: 8 }}>
              {REGIONS.map(r => (
                <motion.button
                  key={r.id}
                  onClick={() => { setRegion(r.id); setSelectedBoards([]); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: "clamp(8px, 2vw, 10px) clamp(10px, 2.5vw, 14px)", background: region === r.id ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${region === r.id ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: 8, color: region === r.id ? "#2563eb" : "#64748b",
                    fontSize: "clamp(12px, 3vw, 13px)", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    transition: "all 0.15s", display: "flex", alignItems: "center", gap: 10,
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{r.flag}</span>
                  <span>{r.label}</span>
                  {region === r.id && <Check size={12} color="#3b82f6" strokeWidth={2.5} style={{ marginLeft: "auto" }} />}
                </motion.button>
              ))}
            </div>
            {region === "Other" && (
              <motion.input
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                type="text" placeholder="Enter your country or region..."
                value={customRegionText} onChange={e => setCustomRegionText(e.target.value)}
                style={{ ...inputStyle, marginTop: 8 }}
              />
            )}
          </div>

          {/* Boards — multi-select */}
          {region && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
              <label style={labelStyle}>EXAM BOARDS YOU TEACH</label>
              <p style={{ fontSize: 11, color: "#475569", margin: "0 0 10px" }}>
                Select all that apply — you can teach across multiple boards
              </p>

              {/* No board option */}
              <motion.button
                onClick={() => setSelectedBoards(prev =>
                  prev.includes("none") ? prev.filter(b => b !== "none") : ["none"]
                )}
                whileHover={{ scale: 1.01 }}
                style={{
                  width: "100%", padding: "10px 14px",
                  background: selectedBoards.includes("none") ? "#f0fdf4" : "#f8fafc",
                  border: `1px solid ${selectedBoards.includes("none") ? "#22c55e" : "#e2e8f0"}`,
                  borderRadius: 8, color: selectedBoards.includes("none") ? "#16a34a" : "#64748b",
                  fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  marginBottom: 6, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>No specific exam board</div>
                  <div style={{ fontSize: 11, opacity: 0.7, marginTop: 1 }}>
                    e.g. university, professional training, tutoring without a set syllabus
                  </div>
                </div>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${selectedBoards.includes("none") ? "#22c55e" : "#e2e8f0"}`,
                  background: selectedBoards.includes("none") ? "#22c55e" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                }}>
                  {selectedBoards.includes("none") && <Check size={10} color="white" strokeWidth={3} />}
                </div>
              </motion.button>

              {!selectedBoards.includes("none") && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {regionBoards.filter(b => b.id !== "other").map(board => {
                    const isSelected = selectedBoards.includes(board.id);
                    return (
                      <motion.button
                        key={board.id}
                        onClick={() => setSelectedBoards(prev =>
                          prev.includes(board.id) ? prev.filter(b => b !== board.id) : [...prev, board.id]
                        )}
                        whileHover={{ scale: 1.01 }}
                        style={{
                          padding: "10px 14px", background: isSelected ? "#eff6ff" : "#f8fafc",
                          border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                          borderRadius: 8, color: isSelected ? "#2563eb" : "#64748b",
                          fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                          display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s",
                        }}
                      >
                        {board.name}
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: `2px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                          background: isSelected ? "#3b82f6" : "transparent",
                          display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                        }}>
                          {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                        </div>
                      </motion.button>
                    );
                  })}
                  {/* Other board */}
                  <motion.button
                    onClick={() => setSelectedBoards(prev =>
                      prev.includes("other") ? prev.filter(b => b !== "other") : [...prev, "other"]
                    )}
                    whileHover={{ scale: 1.01 }}
                    style={{
                      padding: "10px 14px", background: selectedBoards.includes("other") ? "#eff6ff" : "#f8fafc",
                      border: `1px solid ${selectedBoards.includes("other") ? "#3b82f6" : "#e2e8f0"}`,
                      borderRadius: 8, color: selectedBoards.includes("other") ? "#2563eb" : "#64748b",
                      fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                      display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s",
                    }}
                  >
                    Other / Not listed
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${selectedBoards.includes("other") ? "#3b82f6" : "#e2e8f0"}`,
                      background: selectedBoards.includes("other") ? "#3b82f6" : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                    }}>
                      {selectedBoards.includes("other") && <Check size={10} color="white" strokeWidth={3} />}
                    </div>
                  </motion.button>
                  {selectedBoards.includes("other") && (
                    <motion.input
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      type="text" placeholder="Enter exam board name..."
                      value={customBoardText} onChange={e => setCustomBoardText(e.target.value)}
                      style={inputStyle}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Levels — multi-select */}
          {region && selectedBoards.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
              <label style={labelStyle}>LEVELS YOU TEACH</label>
              <p style={{ fontSize: 11, color: "#475569", margin: "0 0 10px" }}>
                Select all levels — you can teach across multiple year groups
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ALL_LEVELS.map(lvl => {
                  const isSelected = selectedLevels.includes(lvl.id);
                  return (
                    <motion.button
                      key={lvl.id}
                      onClick={() => setSelectedLevels(prev =>
                        prev.includes(lvl.id) ? prev.filter(l => l !== lvl.id) : [...prev, lvl.id]
                      )}
                      whileHover={{ scale: 1.01 }}
                      style={{
                        padding: "10px 14px", background: isSelected ? "#eff6ff" : "#f8fafc",
                        border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                        borderRadius: 8, color: isSelected ? "#2563eb" : "#64748b",
                        fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        display: "flex", alignItems: "center", justifyContent: "space-between", transition: "all 0.15s",
                      }}
                    >
                      {lvl.label}
                      <div style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `2px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                        background: isSelected ? "#3b82f6" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                      }}>
                        {isSelected && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={handleBack}
              style={{
                flex: "0 0 auto", padding: "10px 20px", background: "transparent",
                border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b",
                fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >
              ← Back
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onStepChange(3)}
              style={{
                flex: 1, padding: "10px 24px",
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "none", borderRadius: 8, color: "white",
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Continue →
            </motion.button>
          </div>
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              Step 3 of 4
            </div>
            <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Set up your classes
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Add your classes now or skip and create them from your dashboard later.
            </p>
          </div>

          {/* Teaching mode */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>HOW DO YOU TEACH?</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {[
                { id: "groups", label: "Class groups", detail: "You teach classes or sets of students together" },
                { id: "one_on_one", label: "1:1 tutoring", detail: "You work with individual students privately" },
                { id: "mixed", label: "Both", detail: "You do group teaching and individual sessions" },
              ].map(mode => (
                <motion.button
                  key={mode.id}
                  onClick={() => setTeachingMode(mode.id)}
                  whileHover={{ scale: 1.01 }}
                  style={{
                    padding: "12px 14px", background: teachingMode === mode.id ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${teachingMode === mode.id ? "#3b82f6" : "#e2e8f0"}`,
                    borderRadius: 8, color: teachingMode === mode.id ? "#2563eb" : "#64748b",
                    fontSize: 13, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{mode.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 1 }}>{mode.detail}</div>
                  </div>
                  <div style={{
                    width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                    border: `2px solid ${teachingMode === mode.id ? "#3b82f6" : "#e2e8f0"}`,
                    background: teachingMode === mode.id ? "#3b82f6" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}>
                    {teachingMode === mode.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Classes list */}
          {(teachingMode === "groups" || teachingMode === "mixed") && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <label style={{ ...labelStyle, margin: 0 }}>YOUR CLASSES</label>
                <button
                  onClick={addClass}
                  style={{
                    background: "none", border: "none", color: "#3b82f6",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  <Plus size={12} /> Add class
                </button>
              </div>

              {classes.length === 0 ? (
                <div style={{
                  padding: 20, background: "#f8fafc", border: "1px dashed #e2e8f0",
                  borderRadius: 8, textAlign: "center", color: "#e2e8f0", fontSize: 13,
                }}>
                  No classes added yet — click "Add class" above or skip this step
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {classes.map(cls => (
                    <motion.div
                      key={cls.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0",
                        borderRadius: 8, display: "flex", alignItems: "center", gap: 10,
                      }}
                    >
                      <input
                        type="text"
                        placeholder="e.g. Year 11 Maths, Biology Set 1..."
                        value={cls.name}
                        onChange={e => updateClass(cls.id, "name", e.target.value)}
                        style={{
                          flex: 1, background: "none", border: "none", color: "#0f172a",
                          fontSize: 13, outline: "none", fontFamily: "inherit",
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Students"
                        min={1}
                        value={cls.studentCount}
                        onChange={e => updateClass(cls.id, "studentCount", e.target.value)}
                        style={{
                          width: 80, padding: "4px 8px", background: "#ffffff",
                          border: "1px solid #e2e8f0", borderRadius: 6, color: "#94a3b8",
                          fontSize: 12, outline: "none", fontFamily: "inherit", textAlign: "center",
                        }}
                      />
                      <button
                        onClick={() => removeClass(cls.id)}
                        style={{
                          background: "none", border: "none", color: "#e2e8f0",
                          cursor: "pointer", padding: 0, fontSize: 16, transition: "color 0.15s",
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#e2e8f0"}
                      >
                        ×
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}

              {showClassError && (
                <div style={{
                  marginTop: 8, padding: "8px 12px", background: "#fef2f2",
                  border: "1px solid #fecaca", borderRadius: 6, fontSize: 12, color: "#dc2626",
                }}>
                  Please enter a name for each class you've added
                </div>
              )}
            </motion.div>
          )}

          {/* Navigation */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              onClick={handleBack}
              style={{
                flex: "0 0 auto", padding: "10px 20px", background: "transparent",
                border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b",
                fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >
              ← Back
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStep3Continue}
              style={{
                flex: 1, padding: "10px 24px",
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "none", borderRadius: 8, color: "white",
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Continue →
            </motion.button>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: "#3b82f6", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
              Step 4 of 4
            </div>
            <h1 style={{ fontSize: "clamp(20px, 5vw, 24px)", fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
              Almost done
            </h1>
            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
              Add a short bio so students know who you are. This is optional.
            </p>
          </div>

          {/* Bio */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>YOUR BIO (OPTIONAL)</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="e.g. Experienced Maths teacher with 10 years in secondary education. Specialising in GCSE and A-Level preparation..."
              rows={4}
              maxLength={300}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
            <div style={{ fontSize: 11, color: "#e2e8f0", textAlign: "right", marginTop: 4 }}>
              {bio.length}/300
            </div>
          </div>

          {/* Availability */}
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>AVAILABILITY (OPTIONAL)</label>
            <p style={{ fontSize: 11, color: "#475569", margin: "0 0 10px" }}>
              Let students know when you're generally available
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 6 }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                const isSelected = !!availability[day];
                return (
                  <motion.button
                    key={day}
                    onClick={() => setAvailability(prev => ({ ...prev, [day]: !prev[day] }))}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      padding: "8px 4px", background: isSelected ? "#eff6ff" : "#f8fafc",
                      border: `1px solid ${isSelected ? "#3b82f6" : "#e2e8f0"}`,
                      borderRadius: 8, color: isSelected ? "#2563eb" : "#64748b",
                      fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      textAlign: "center", transition: "all 0.15s",
                    }}
                  >
                    {day}
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleBack}
              style={{
                flex: "0 0 auto", padding: "10px 20px", background: "transparent",
                border: "1px solid #e2e8f0", borderRadius: 8, color: "#64748b",
                fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#475569"; e.currentTarget.style.color = "#94a3b8"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >
              ← Back
            </button>
            <motion.button
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
              onClick={handleComplete}
              disabled={isSubmitting}
              style={{
                flex: 1, padding: "13px",
                background: isSubmitting ? "#ffffff" : "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "none", borderRadius: 8,
                color: isSubmitting ? "#e2e8f0" : "white",
                fontSize: 15, fontWeight: 700,
                cursor: isSubmitting ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >
              {isSubmitting ? "Setting up your account..." : "Go to Dashboard →"}
            </motion.button>
          </div>

          <button
            onClick={handleComplete}
            disabled={isSubmitting}
            style={{
              width: "100%", padding: 8, background: "none", border: "none",
              color: "#e2e8f0", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              marginTop: 8, transition: "color 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#475569"}
            onMouseLeave={e => e.currentTarget.style.color = "#e2e8f0"}
          >
            Skip — I'll fill this in later
          </button>
        </div>
      )}

      {/* Groups modal */}
      {showGroupsModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
            style={{
              background: "#ffffff", border: "1px solid #e2e8f0",
              borderRadius: 16, padding: "clamp(20px, 5vw, 32px) clamp(16px, 4vw, 28px)",
              width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto",
            }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
              Your classes are ready
            </h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 20px" }}>
              Share these invite codes with your students so they can join your classes.
            </p>

            {createdGroups.map((group: any) => (
              <div key={group.id} style={{
                padding: "12px 14px", background: "#f8fafc", border: "1px solid #e2e8f0",
                borderRadius: 8, marginBottom: 8, display: "flex",
                justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{group.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                    Code: <span style={{ color: "#2563eb", fontFamily: "monospace" }}>{group.invite_code}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(group.invite_code)}
                  style={{
                    padding: "5px 12px", background: "transparent", border: "1px solid #e2e8f0",
                    borderRadius: 6, color: "#64748b", fontSize: 11, cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#3b82f6"; e.currentTarget.style.color = "#3b82f6"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
                >
                  Copy
                </button>
              </div>
            ))}

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => { setShowGroupsModal(false); onComplete(); }}
              style={{
                width: "100%", marginTop: 16, padding: 12,
                background: "linear-gradient(135deg, #3b82f6, #2563eb)",
                border: "none", borderRadius: 8, color: "white",
                fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Go to Dashboard →
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </>
  );
};

export default TutorOnboarding;
