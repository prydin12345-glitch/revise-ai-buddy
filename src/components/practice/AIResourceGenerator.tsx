import { useState, useEffect } from "react";
import { Sparkles, Loader2, BookOpen, Pen, Ruler, Hash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getResourceConfig } from "./resource-configs";
import { useSubjectCategory, CATEGORY_LABELS, type SubjectCategory } from "@/hooks/useSubjectCategory";
import type { ResourcePack } from "./ResourcePackUploader";

interface AIResourceGeneratorProps {
  subjectId: string;
  educationalTier?: string;
  examBoard?: string;
  subtopics: string[];
  onPackReady: (pack: ResourcePack) => void;
  subjectColor?: string;
}

const ALL_CATEGORIES: SubjectCategory[] = [
  'english_language', 'english_literature', 'mathematics',
  'biology', 'chemistry', 'physics', 'geography', 'history',
  'business', 'computer_science', 'psychology', 'sociology',
  'art_design', 'music', 'physical_education', 'other'
];

export const AIResourceGenerator = ({
  subjectId,
  educationalTier,
  examBoard,
  subtopics,
  onPackReady,
  subjectColor = "#3b82f6",
}: AIResourceGeneratorProps) => {
  const { category, isLoading: categoryLoading, updateCategory } = useSubjectCategory(subjectId);
  const [showCategoryOverride, setShowCategoryOverride] = useState(false);

  const config = getResourceConfig(category);

  const [sourceType, setSourceType] = useState(config.sourceTypes[0]?.value || "text_extract");
  const [theme, setTheme] = useState("");
  const [extractLength, setExtractLength] = useState("medium");
  const [lineNumberEvery, setLineNumberEvery] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [extraValues, setExtraValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    config.extraFields?.forEach((f) => {
      defaults[f.key] = f.defaultValue || "";
    });
    return defaults;
  });

  // Reset form fields when category changes
  useEffect(() => {
    const newConfig = getResourceConfig(category);
    setSourceType(newConfig.sourceTypes[0]?.value || "text_extract");
    setExtractLength("medium");
    const defaults: Record<string, string> = {};
    newConfig.extraFields?.forEach((f) => {
      defaults[f.key] = f.defaultValue || "";
    });
    setExtraValues(defaults);
  }, [category]);

  const handleCategoryOverride = (newCategory: SubjectCategory) => {
    updateCategory(newCategory);
    setShowCategoryOverride(false);
  };

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
          subjectCategory: category,
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

  if (categoryLoading) {
    return (
      <Card className="p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Detecting subject type...</span>
      </Card>
    );
  }

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
        
        {/* Category indicator */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-[11px] text-muted-foreground">Detected as:</span>
          <Badge variant="secondary" className="text-[11px] px-2 py-0 h-5 font-normal">
            {CATEGORY_LABELS[category] || category}
          </Badge>
          {!showCategoryOverride ? (
            <button
              onClick={() => setShowCategoryOverride(true)}
              className="text-[11px] text-muted-foreground/70 hover:text-muted-foreground underline cursor-pointer bg-transparent border-none p-0"
            >
              Wrong? Change it
            </button>
          ) : (
            <Select
              value={category}
              onValueChange={(v) => handleCategoryOverride(v as SubjectCategory)}
            >
              <SelectTrigger className="h-6 text-[11px] w-auto min-w-[140px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
