import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Table, Image, BookOpen, BarChart3, MapPin, Mic, Beaker } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ResourcePack, ResourceItem } from "./ResourcePackUploader";

interface ResourcePackPreviewProps {
  pack: ResourcePack;
  subjectColor?: string;
  maxHeight?: string;
  expandable?: boolean;
}

const getResourceIcon = (type: string) => {
  switch (type) {
    case 'text_extract':
    case 'poem_excerpt':
    case 'primary_source':
    case 'historian_interpretation':
      return BookOpen;
    case 'case_study':
    case 'article':
      return FileText;
    case 'data_table':
    case 'experiment_data':
      return Table;
    case 'graph':
      return BarChart3;
    case 'map':
      return MapPin;
    case 'image':
      return Image;
    case 'transcript':
      return Mic;
    default:
      return FileText;
  }
};

const getResourceTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    text_extract: 'Text Extract',
    case_study: 'Case Study',
    data_table: 'Data Table',
    map: 'Map',
    image: 'Image',
    graph: 'Graph',
    transcript: 'Transcript',
    article: 'Article',
    experiment_data: 'Experiment Data',
    poem_excerpt: 'Poem',
    primary_source: 'Primary Source',
    historian_interpretation: 'Interpretation',
  };
  return labels[type] || type;
};

interface ResourceItemCardProps {
  item: ResourceItem;
  subjectColor?: string;
  defaultExpanded?: boolean;
}

const ResourceItemCard = ({ item, subjectColor, defaultExpanded = false }: ResourceItemCardProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const Icon = getResourceIcon(item.resource_type);

  const contentPreview = item.content_text 
    ? item.content_text.substring(0, 200) + (item.content_text.length > 200 ? '...' : '')
    : null;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left">
            <div 
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: `${subjectColor}15` }}
            >
              <Icon className="h-4 w-4" style={{ color: subjectColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{item.source_label}</span>
                <Badge variant="outline" className="text-xs">
                  {getResourceTypeLabel(item.resource_type)}
                </Badge>
                {item.word_count && (
                  <span className="text-xs text-muted-foreground">
                    {item.word_count} words
                  </span>
                )}
              </div>
              {!isExpanded && contentPreview && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {contentPreview}
                </p>
              )}
            </div>
            <div className="shrink-0 pt-1">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 border-t">
            {item.attribution && (
              <p className="text-xs text-muted-foreground italic mb-2">
                {item.attribution}
              </p>
            )}
            {item.content_text && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto">
                {item.content_text}
              </div>
            )}
            {item.content_url && (
              <div className="mt-2">
                <img 
                  src={item.content_url} 
                  alt={item.source_label}
                  className="max-w-full rounded-lg border"
                />
              </div>
            )}
            {item.content_json && (
              <div className="mt-2 bg-muted/50 rounded-lg p-3 overflow-x-auto">
                <pre className="text-xs">
                  {JSON.stringify(item.content_json, null, 2)}
                </pre>
              </div>
            )}
            {item.difficulty_contribution && (
              <Badge 
                variant="outline" 
                className="mt-2 capitalize"
              >
                {item.difficulty_contribution} complexity
              </Badge>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export const ResourcePackPreview = ({
  pack,
  subjectColor = "#3b82f6",
  maxHeight = "400px",
  expandable = true,
}: ResourcePackPreviewProps) => {
  if (!pack.items || pack.items.length === 0) {
    return (
      <Card className="p-6 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No resources extracted yet</p>
      </Card>
    );
  }

  const sortedItems = [...pack.items].sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium text-sm">{pack.title}</h4>
          <p className="text-xs text-muted-foreground">
            {pack.items.length} resource{pack.items.length !== 1 ? 's' : ''} • {pack.pack_type === 'uploaded' ? 'Uploaded' : 'AI Generated'}
          </p>
        </div>
      </div>
      
      <ScrollArea style={{ maxHeight }} className="pr-2">
        <div className="space-y-2">
          {sortedItems.map((item, index) => (
            <ResourceItemCard 
              key={item.id} 
              item={item} 
              subjectColor={subjectColor}
              defaultExpanded={index === 0}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
