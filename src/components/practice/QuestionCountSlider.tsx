import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

interface QuestionCountSliderProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
}

export function QuestionCountSlider({
  value,
  onChange,
  max = 30,
}: QuestionCountSliderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="question-count">Number of Questions</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>We recommend up to 30 questions per set to optimize AI performance</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="text-3xl font-bold text-primary">{value}</div>
      </div>

      <Slider
        id="question-count"
        min={1}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(values) => onChange(values[0])}
        className="w-full"
      />

      <div className="flex justify-between text-xs text-muted-foreground">
        <span>1 question</span>
        <span>{max} questions</span>
      </div>
    </div>
  );
}
