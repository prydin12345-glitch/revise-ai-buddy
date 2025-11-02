import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette, Plus } from "lucide-react";
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
}

const PREDEFINED_SUBJECTS = [
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "English",
  "History",
  "Geography",
  "Computer Science",
  "Economics",
  "Psychology",
  "Business Studies",
  "Sociology",
  "Politics",
  "Philosophy",
  "Law",
  "Art",
  "Music",
  "French",
  "Spanish",
  "German",
];

const PRESET_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#8B5CF6", // Purple
  "#14B8A6", // Teal
  "#FF7F6A", // Coral
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#EF4444", // Red
  "#6366F1", // Indigo
  "#06B6D4", // Cyan
];

export const SubjectSelector = ({ value, color, onValueChange, onColorChange, showLabel = true }: SubjectSelectorProps) => {
  const [isCustom, setIsCustom] = useState(false);
  const [customSubject, setCustomSubject] = useState("");

  const handleSubjectChange = (newValue: string) => {
    if (newValue === "custom") {
      setIsCustom(true);
    } else {
      setIsCustom(false);
      onValueChange(newValue);
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
            <SelectContent className="bg-background border-border z-[100]">
              {PREDEFINED_SUBJECTS.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
              <SelectItem value="custom" className="font-semibold text-primary">
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Custom Subject
                </div>
              </SelectItem>
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
                    onClick={() => onColorChange(presetColor)}
                  />
                ))}
              </div>
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground">Custom Color</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="color"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={color}
                    onChange={(e) => onColorChange(e.target.value)}
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

// Helper function to determine text color based on background
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 128 ? "#000000" : "#FFFFFF";
}
