import { FileText, Sparkles, FileEdit } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type ResourceMode = 'none' | 'uploaded' | 'ai_generated';

interface ResourceModeSelectorProps {
  value: ResourceMode;
  onChange: (mode: ResourceMode) => void;
  subjectColor?: string;
  disabled?: boolean;
}

export const ResourceModeSelector = ({
  value,
  onChange,
  subjectColor = "#3b82f6",
  disabled = false,
}: ResourceModeSelectorProps) => {
  const options: { mode: ResourceMode; icon: typeof FileText; title: string; description: string }[] = [
    {
      mode: 'none',
      icon: FileEdit,
      title: 'Standalone Questions',
      description: 'Traditional questions without shared resources',
    },
    {
      mode: 'uploaded',
      icon: FileText,
      title: 'Upload Insert/Resources',
      description: 'Upload an exam insert PDF to generate linked questions',
    },
    {
      mode: 'ai_generated',
      icon: Sparkles,
      title: 'AI-Generated Resources',
      description: 'Let AI create realistic sources, then build questions',
    },
  ];

  return (
    <Card className="p-4">
      <Label className="text-sm font-medium mb-3 block">Resource Mode</Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map(({ mode, icon: Icon, title, description }) => {
          const isSelected = value === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onChange(mode)}
              className={cn(
                "relative flex flex-col items-start p-4 rounded-lg border-2 transition-all text-left",
                "hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20",
                isSelected ? "border-primary bg-primary/5" : "border-border",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              style={isSelected ? { borderColor: subjectColor, backgroundColor: `${subjectColor}10` } : undefined}
            >
              <Icon 
                className={cn("h-5 w-5 mb-2", isSelected ? "text-primary" : "text-muted-foreground")}
                style={isSelected ? { color: subjectColor } : undefined}
              />
              <span className="font-medium text-sm">{title}</span>
              <span className="text-xs text-muted-foreground mt-1">{description}</span>
              {isSelected && (
                <div 
                  className="absolute top-2 right-2 w-2 h-2 rounded-full"
                  style={{ backgroundColor: subjectColor }}
                />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
};
