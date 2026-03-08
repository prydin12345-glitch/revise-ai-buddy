import { useState } from "react";
import { Sparkles, Loader2, BookOpen, Pen, Ruler, GraduationCap, Hash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getResourceConfig } from "./resource-configs";
import type { ResourcePack } from "./ResourcePackUploader";

interface AIResourceGeneratorProps {
  subjectId: string;
  educationalTier?: string;
  examBoard?: string;
  subtopics: string[];
  onPackReady: (pack: ResourcePack) => void;
  subjectColor?: string;
}

export const AIResourceGenerator = ({
  subjectId,
  educationalTier,
  examBoard,
  subtopics,
  onPackReady,
  subjectColor = "#3b82f6",
}: AIResourceGeneratorProps) => {
  const config = getResourceConfig(subjectId);

  const [sourceType, setSourceType] = useState(config.sourceTypes[0]?.value || "text_extract");
  const [theme, setTheme] = useState("");
  const [extractLength, setExtractLength] = useState("medium");
  
  const [lineNumberEvery, setLineNumberEvery] = useState(true); // true = every 5, false = every line
  const [generating, setGenerating] = useState(false);

  // Extra fields state
  const [extraValues, setExtraValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    config.extraFields?.forEach((f) => {
      defaults[f.key] = f.defaultValue || "";
    });
    return defaults;
  });

  const handleGenerate = async () => {
    if (!theme.trim()) {
      toast.error(`Please enter a ${config.themeLabel.toLowerCase()}`);
      return;
    }

    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please log in to generate resources");
        return;
      }

      const resourceCount = parseInt(extraValues.resourceCount || "1", 10) || 1;

      const { data, error } = await supabase.functions.invoke('generate-resource-pack', {
        body: {
          subjectId,
          topic: theme,
          educationalTier,
          examBoard,
          subtopics,
          resourceCount,
          sourceType,
          extractLength: config.showLength ? extractLength : undefined,
          lineNumbering: config.showLineNumbering ? (lineNumberEvery ? 'every_5' : 'every_line') : undefined,
          extraFields: extraValues,
        },
      });

      if (error) throw error;

      const pack: ResourcePack = {
        id: data.packId,
        title: data.title || `${theme} Resources`,
        subject_id: subjectId,
        pack_type: 'ai_generated',
        status: 'ready',
        items: data.items || [],
      };

      onPackReady(pack);
      toast.success(`Generated ${pack.items.length} resource${pack.items.length !== 1 ? 's' : ''} for "${theme}"`);
    } catch (error: any) {
      console.error("Error generating resource pack:", error);
      toast.error(error.message || "Failed to generate resource pack");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div
        className="px-4 py-3 border-b"
        style={{ borderColor: `${subjectColor}30` }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: subjectColor }} />
          <span className="text-sm font-semibold">{config.label}</span>
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* Source Type */}
        <div className="px-4 py-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Pen className="h-3 w-3" />
            {config.sourceTypeLabel}
          </Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.sourceTypes.map((st) => (
                <SelectItem key={st.value} value={st.value}>
                  {st.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme / Topic */}
        <div className="px-4 py-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            ✏️ {config.themeLabel}
          </Label>
          <Input
            placeholder={config.themePlaceholder}
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground/70">{config.themeHelperText}</p>
        </div>

        {/* Extract Length (radio buttons) */}
        {config.showLength && config.lengthOptions && (
          <div className="px-4 py-3 space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Ruler className="h-3 w-3" />
              Extract Length
            </Label>
            <RadioGroup value={extractLength} onValueChange={setExtractLength} className="space-y-1.5">
              {config.lengthOptions.map((opt) => (
                <div key={opt.value} className="flex items-center gap-2">
                  <RadioGroupItem value={opt.value} id={`len-${opt.value}`} />
                  <Label
                    htmlFor={`len-${opt.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        {/* Reading Level */}
        {config.showReadingLevel && config.readingLevelOptions && (
          <div className="px-4 py-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <GraduationCap className="h-3 w-3" />
              Reading Level
            </Label>
            <Select value={readingLevel} onValueChange={setReadingLevel}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {config.readingLevelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Line Numbering Toggle */}
        {config.showLineNumbering && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Hash className="h-3 w-3" />
                Line Numbering
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {lineNumberEvery ? 'Every 5 lines' : 'Every line'}
                </span>
                <Switch
                  checked={lineNumberEvery}
                  onCheckedChange={setLineNumberEvery}
                />
              </div>
            </div>
          </div>
        )}

        {/* Extra Fields */}
        {config.extraFields?.map((field) => (
          <div key={field.key} className="px-4 py-3 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{field.label}</Label>
            {field.type === 'select' && field.options && (
              <Select
                value={extraValues[field.key] || field.defaultValue}
                onValueChange={(v) => setExtraValues((prev) => ({ ...prev, [field.key]: v }))}
              >
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ))}
      </div>

      {/* Generate Button */}
      <div className="px-4 py-3 border-t">
        <Button
          onClick={handleGenerate}
          disabled={generating || !theme.trim()}
          className="w-full"
          style={{ backgroundColor: subjectColor }}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Resource
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
