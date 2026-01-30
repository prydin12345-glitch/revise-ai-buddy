import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ResourcePack } from "./ResourcePackUploader";

const SUBJECT_RESOURCE_TYPES: Record<string, string[]> = {
  'english_literature': ['text_extract', 'poem_excerpt'],
  'english_language': ['article', 'transcript', 'text_extract'],
  'english': ['text_extract', 'article', 'transcript'],
  'history': ['primary_source', 'historian_interpretation', 'image'],
  'geography': ['case_study', 'data_table', 'article'],
  'economics': ['case_study', 'data_table', 'article', 'graph'],
  'business': ['case_study', 'data_table', 'article'],
  'biology': ['experiment_data', 'data_table', 'graph', 'image'],
  'chemistry': ['experiment_data', 'data_table', 'graph'],
  'physics': ['experiment_data', 'data_table', 'graph'],
  'psychology': ['case_study', 'data_table', 'article'],
  'sociology': ['case_study', 'data_table', 'article'],
};

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
  const [topic, setTopic] = useState("");
  const [resourceCount, setResourceCount] = useState<string>("3");
  const [generating, setGenerating] = useState(false);

  const suggestedResourceTypes = SUBJECT_RESOURCE_TYPES[subjectId.toLowerCase()] || ['text_extract', 'data_table'];
  
  // Minimum of 1 resource, max of 5
  const minResourceCount = 1;

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic for the resource pack");
      return;
    }

    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Please log in to generate resources");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-resource-pack', {
        body: {
          subjectId,
          topic,
          educationalTier,
          examBoard,
          subtopics,
          resourceCount: parseInt(resourceCount),
          resourceTypes: suggestedResourceTypes,
        },
      });

      if (error) throw error;

      const pack: ResourcePack = {
        id: data.packId,
        title: data.title || `${topic} Resources`,
        subject_id: subjectId,
        pack_type: 'ai_generated',
        status: 'ready',
        items: data.items || [],
      };

      onPackReady(pack);
      toast.success(`Generated ${pack.items.length} resources for "${topic}"`);
    } catch (error: any) {
      console.error("Error generating resource pack:", error);
      toast.error(error.message || "Failed to generate resource pack");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card className="p-4">
      <Label className="text-sm font-medium mb-3 block">Generate AI Resources</Label>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="resource-topic" className="text-xs text-muted-foreground">
            Topic for resource pack
          </Label>
          <Input
            id="resource-topic"
            placeholder={`e.g., "${subjectId === 'geography' ? 'Climate change in coastal regions' : subjectId === 'english' ? 'Victorian social commentary' : 'Enter a topic...'}"`}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Number of resources
          </Label>
          <Select value={resourceCount} onValueChange={setResourceCount}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 resource</SelectItem>
              <SelectItem value="2">2 resources</SelectItem>
              <SelectItem value="3">3 resources</SelectItem>
              <SelectItem value="4">4 resources</SelectItem>
              <SelectItem value="5">5 resources</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-muted-foreground">
          <p className="mb-1">Will generate:</p>
          <ul className="list-disc list-inside space-y-0.5">
            {suggestedResourceTypes.slice(0, 3).map((type) => (
              <li key={type} className="capitalize">{type.replace('_', ' ')}</li>
            ))}
          </ul>
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={generating || !topic.trim()}
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
              Generate Resources
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};
