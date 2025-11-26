import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus } from "lucide-react";
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
  { id: "other", label: "Other" }
];

const CURRICULUM_TAGS = ["GCSE", "A-Level", "IB", "AP", "BTEC", "Scottish Higher", "Other"];

const SubjectsSelection = ({ subjects, onComplete }: SubjectsSelectionProps) => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjects, setSelectedSubjects] = useState<UserSubject[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [customCurriculum, setCustomCurriculum] = useState("");

  const filteredSubjects = subjects.filter(s => {
    const matchesCategory = selectedCategory === "all" || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleSubject = (subject: Subject) => {
    const exists = selectedSubjects.find(s => s.subject_id === subject.id);
    if (exists) {
      setSelectedSubjects(selectedSubjects.filter(s => s.subject_id !== subject.id));
    } else {
      setSelectedSubjects([
        ...selectedSubjects,
        {
          subject_id: subject.id,
          subject_name: subject.name, // Always set subject_name
          subject_color: getSubjectColor(subject.category),
          is_custom: false, // Explicitly false
          user_id: ""
        }
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
      subject_id: undefined
    };

    console.log("Adding custom subject:", newSubject);
    setSelectedSubjects([...selectedSubjects, newSubject]);
    setCustomSubjectName("");
    setCustomCurriculum("");
    setShowCustomModal(false);
  };

  const getSubjectColor = (category: string) => {
    const colors: Record<string, string> = {
      sciences: "#10b981",
      maths: "#3b82f6",
      languages: "#8b5cf6",
      humanities: "#f59e0b",
      other: "#6b7280"
    };
    return colors[category] || "#6b7280";
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {CATEGORIES.map(cat => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.label}
          </Button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search subjects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
        {filteredSubjects.map(subject => {
          const isSelected = selectedSubjects.some(s => s.subject_id === subject.id);
          return (
            <Card
              key={subject.id}
              className={`p-4 cursor-pointer transition-all ${
                isSelected ? "border-primary bg-primary/5" : "hover:border-primary/50"
              }`}
              onClick={() => toggleSubject(subject)}
            >
              <div className="flex items-center space-x-2">
                <Checkbox checked={isSelected} />
                <Label className="cursor-pointer font-normal">{subject.name}</Label>
              </div>
            </Card>
          );
        })}
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => setShowCustomModal(true)}
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Custom Subject
      </Button>

      {selectedSubjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSubjects.map((s, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-sm"
            >
              {s.custom_name || s.subject_name}
              {s.curriculum_tag && (
                <span className="text-xs opacity-70">({s.curriculum_tag})</span>
              )}
            </span>
          ))}
        </div>
      )}

      <Button
        onClick={() => {
          if (selectedSubjects.length === 0) return;

          // Validate subjects before continuing
          const invalidSubjects = selectedSubjects.filter(s => {
            if (!s.is_custom && !s.subject_id) {
              console.error("Non-custom subject missing subject_id:", s);
              return true;
            }
            return false;
          });

          if (invalidSubjects.length > 0) {
            console.error("Found invalid subjects:", invalidSubjects);
            return;
          }

          console.log("Continuing with subjects:", selectedSubjects);
          onComplete(selectedSubjects);
        }}
        disabled={selectedSubjects.length === 0}
        className="w-full"
      >
        Continue
      </Button>

      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Subject</DialogTitle>
            <DialogDescription>
              Add a subject that's not in our list. You can optionally specify the curriculum.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Subject Name</Label>
              <Input
                value={customSubjectName}
                onChange={(e) => setCustomSubjectName(e.target.value)}
                placeholder="e.g., Music Theory"
              />
            </div>
            <div>
              <Label>Curriculum (Optional)</Label>
              <Select value={customCurriculum} onValueChange={setCustomCurriculum}>
                <SelectTrigger>
                  <SelectValue placeholder="Select curriculum" />
                </SelectTrigger>
                <SelectContent>
                  {CURRICULUM_TAGS.map(tag => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomModal(false)}>
              Cancel
            </Button>
            <Button onClick={addCustomSubject}>Add Subject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubjectsSelection;
