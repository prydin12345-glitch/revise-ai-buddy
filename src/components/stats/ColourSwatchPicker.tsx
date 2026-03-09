import { PRESET_COLOURS } from "@/lib/subject-colours";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ColourSwatchPickerProps {
  value: string;
  onChange: (colour: string) => void;
  usedColours?: string[];
}

export const ColourSwatchPicker = ({ value, onChange, usedColours = [] }: ColourSwatchPickerProps) => {
  const normalUsed = usedColours.map(c => c.toLowerCase());

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">Subject Colour</Label>
      <div className="grid grid-cols-6 gap-2">
        {PRESET_COLOURS.map(colour => {
          const isUsed = normalUsed.includes(colour.toLowerCase());
          const isSelected = value.toLowerCase() === colour.toLowerCase();
          return (
            <button
              key={colour}
              type="button"
              onClick={() => onChange(colour)}
              className="w-9 h-9 rounded-lg transition-all border-2"
              style={{
                backgroundColor: colour,
                borderColor: isSelected ? 'hsl(var(--foreground))' : 'transparent',
                opacity: isUsed && !isSelected ? 0.3 : 1,
                transform: isSelected ? 'scale(1.1)' : 'scale(1)',
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div
          className="w-7 h-7 rounded border border-border shrink-0"
          style={{ backgroundColor: value }}
        />
        <Input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#3b82f6"
          className="w-24 h-8 text-xs"
        />
        <span className="text-[11px] text-muted-foreground">or enter custom hex</span>
      </div>
    </div>
  );
};
