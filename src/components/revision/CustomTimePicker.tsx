import { useState } from "react";
import { ChevronUp, ChevronDown, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface CustomTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const CustomTimePicker = ({ value, onChange, className }: CustomTimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hour, minute] = value.split(':').map(Number);
  
  const handleHourChange = (newHour: number) => {
    const normalizedHour = ((newHour % 24) + 24) % 24;
    onChange(`${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  };
  
  const handleMinuteChange = (newMinute: number) => {
    const normalizedMinute = ((newMinute % 60) + 60) % 60;
    onChange(`${String(hour).padStart(2, '0')}:${String(normalizedMinute).padStart(2, '0')}`);
  };
  
  const ScrollableNumber = ({ 
    value, 
    max, 
    onChange, 
    label 
  }: { 
    value: number; 
    max: number; 
    onChange: (val: number) => void; 
    label: string;
  }) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [isScrolling, setIsScrolling] = useState(false);
    
    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (isScrolling) return;
      
      setIsScrolling(true);
      
      if (e.deltaY < 0) {
        // Scroll up - increment
        onChange(value + 1);
      } else if (e.deltaY > 0) {
        // Scroll down - decrement
        onChange(value - 1);
      }
      
      // Debounce to prevent rapid scrolling
      setTimeout(() => setIsScrolling(false), 100);
    };
    
    const handleTouchStart = (e: React.TouchEvent) => {
      setTouchStart(e.touches[0].clientY);
    };
    
    const handleTouchMove = (e: React.TouchEvent) => {
      if (touchStart === null) return;
      
      const touchEnd = e.touches[0].clientY;
      const delta = touchStart - touchEnd;
      
      // Swipe threshold to trigger change
      if (Math.abs(delta) > 30) {
        if (delta > 0) {
          // Swipe up - increment
          onChange(value + 1);
        } else {
          // Swipe down - decrement
          onChange(value - 1);
        }
        setTouchStart(touchEnd); // Reset for continuous swiping
      }
    };
    
    const handleTouchEnd = () => {
      setTouchStart(null);
    };
    
    return (
      <div className="flex flex-col items-center gap-1">
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onChange(value + 1)}
          className="h-8 w-8 hover:bg-primary/20 text-foreground"
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
        
        {/* Tunnel effect with gradient fade */}
        <div 
          className="relative h-24 overflow-hidden cursor-ns-resize select-none"
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="h-1/3 bg-gradient-to-b from-background to-transparent" />
            <div className="h-1/3" />
            <div className="h-1/3 bg-gradient-to-t from-background to-transparent" />
          </div>
          
          {/* Selected value */}
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl font-bold text-primary px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 shadow-[0_0_10px_rgba(var(--primary),0.3)] transition-all duration-200 ease-out">
              {String(value).padStart(2, '0')}
            </span>
          </div>
        </div>
        
        <Button 
          size="icon" 
          variant="ghost" 
          onClick={() => onChange(value - 1)}
          className="h-8 w-8 hover:bg-primary/20 text-foreground"
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground mt-1">{label}</span>
      </div>
    );
  };
  
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className={cn("w-full justify-start text-left min-h-[44px]", className)}
        >
          <Clock className="mr-2 h-4 w-4 text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]" />
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 bg-background border-border">
        <div className="flex gap-4 items-center">
          <ScrollableNumber 
            value={hour} 
            max={24} 
            onChange={handleHourChange}
            label="Hour"
          />
          <span className="text-3xl font-bold text-muted-foreground">:</span>
          <ScrollableNumber 
            value={minute} 
            max={60} 
            onChange={handleMinuteChange}
            label="Minute"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
