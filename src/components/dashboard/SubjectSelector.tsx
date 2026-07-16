/**
 * SubjectSelector - Subject and color picker component
 * 
 * Shows user's saved custom subjects alongside predefined subjects.
 */
import { useState, useCallback, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useUserSubjects } from "@/hooks/useUserSubjects";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Plus, Search } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface SubjectSelectorProps {
  value: string;
  color: string;
  onValueChange: (value: string) => void;
  onColorChange: (color: string) => void;
  showLabel?: boolean;
  persistColor?: boolean;
}

const PREDEFINED_SUBJECTS = [
  "Mathematics", "Biology", "Chemistry", "Physics", "English",
  "History", "Geography", "Computer Science", "Economics", "Psychology",
  "Business Studies", "Sociology", "Politics", "Philosophy", "Law",
  "Art", "Music", "French", "Spanish", "German",
];

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#8B5CF6", "#14B8A6", "#FF7F6A",
  "#F59E0B", "#EC4899", "#EF4444", "#6366F1", "#06B6D4",
];

export const SubjectSelector = ({ value, color, onValueChange, onColorChange, showLabel = true, persistColor = true }: SubjectSelectorProps) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customSubject, setCustomSubject] = useState("");
  const [search, setSearch] = useState("");
  const { saveOrUpdateSubject, subjects, getSubjectColor } = useUserSubjects();

  // All of the user's saved subjects (including ones that happen to match predefined names)
  const myUserSubjects = useMemo(() => subjects, [subjects]);

  // Predefined subjects the user hasn't already saved
  const remainingPredefined = useMemo(() => {
    const savedLower = new Set(myUserSubjects.map(s => s.subject_name.toLowerCase()));
    return PREDEFINED_SUBJECTS.filter(s => !savedLower.has(s.toLowerCase()));
  }, [myUserSubjects]);

  const q = search.trim().toLowerCase();
  const filteredMine = q
    ? myUserSubjects.filter(s => s.subject_name.toLowerCase().includes(q))
    : myUserSubjects;
  const filteredPredefined = q
    ? remainingPredefined.filter(s => s.toLowerCase().includes(q))
    : remainingPredefined;

  const handleColorChange = useCallback(async (newColor: string) => {
    onColorChange(newColor);
    if (persistColor && value) {
      try {
        await saveOrUpdateSubject(value, newColor);
      } catch (err) {
        console.error("Error persisting color:", err);
      }
    }
  }, [onColorChange, persistColor, value, saveOrUpdateSubject]);

  const handleSubjectChange = (newValue: string) => {
    if (newValue === "custom") {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      onValueChange(newValue);
      const existingColor = getSubjectColor(newValue);
      if (existingColor && existingColor !== "#3B82F6") {
        onColorChange(existingColor);
      }
    }
  };

  const handleCustomSubmit = () => {
    if (customSubject.trim()) {
      onValueChange(customSubject.trim());
      setIsCustom(false);
      setCustomSubject("");
    }
  };

  return (
    <div className="space-y-3">
      {showLabel && <Label>Subject</Label>}
      <div className="flex gap-2">
        {!isCustom ? (
          <Select value={value} onValueChange={handleSubjectChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent
              className="bg-background border-border z-[100] max-h-[340px] overflow-hidden"
              side="bottom"
              sideOffset={4}
              align="start"
              avoidCollisions={true}
              collisionPadding={16}
              position="popper"
            >
              {/* Search bar */}
              <div
                className="sticky top-0 z-10 bg-background p-2 border-b border-border"
                onKeyDown={(e) => {
                  // prevent Select's built-in typeahead from hijacking keys
                  e.stopPropagation();
                }}
              >
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search subjects…"
                    className="pl-8 h-8 text-sm"
                    // Radix Select steals focus back to the list; prevent that
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              <div className="max-h-[260px] overflow-y-auto">
                {/* User's saved subjects (always shown, including ones matching predefined names) */}
                {filteredMine.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">My Subjects</SelectLabel>
                    {filteredMine.map((subject) => (
                      <SelectItem key={`mine-${subject.id}`} value={subject.subject_name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: subject.subject_color }}
                          />
                          {subject.subject_name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {filteredPredefined.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs font-semibold text-muted-foreground">Standard Subjects</SelectLabel>
                    {filteredPredefined.map((subject) => (
                      <SelectItem key={subject} value={subject}>
                        {subject}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {filteredMine.length === 0 && filteredPredefined.length === 0 && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No subjects match "{search}"
                  </div>
                )}

                <SelectItem value="custom" className="font-semibold text-primary">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Add Custom Subject
                  </div>
                </SelectItem>
              </div>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Enter custom subject"
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
            />
            <Button onClick={handleCustomSubmit} size="sm">
              Add
            </Button>
          </div>
        )}
        
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              style={{ backgroundColor: color }}
            >
              <Palette className="w-4 h-4" style={{ color: getContrastColor(color) }} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 bg-background border-border z-[100]">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Subject Color</Label>
              <div className="grid grid-cols-5 gap-2">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                      color === presetColor ? "border-foreground ring-2 ring-foreground/20" : "border-border"
                    }`}
                    style={{ backgroundColor: presetColor }}
                    onClick={() => handleColorChange(presetColor)}
                  />
                ))}
              </div>
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Custom Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
}