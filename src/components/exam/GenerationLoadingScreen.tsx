import { useEffect, useState } from "react";
import { Sparkles, Atom, BookOpen, FlaskConical, Dna } from "lucide-react";

interface GenerationLoadingScreenProps {
  message: string;
  subjectColor?: string;
}

const subjectIcons: Record<string, typeof Atom> = {
  chemistry: Atom,
  physics: Atom,
  biology: Dna,
  math: BookOpen,
  default: Sparkles,
};

export function GenerationLoadingScreen({ message, subjectColor = "#3B82F6" }: GenerationLoadingScreenProps) {
  const [iconRotation, setIconRotation] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIconRotation((prev) => (prev + 2) % 360);
    }, 16);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <Sparkles 
          className="absolute top-1/4 left-1/4 h-12 w-12 opacity-5 animate-pulse" 
          style={{ animationDelay: "0s" }}
        />
        <Sparkles 
          className="absolute top-1/3 right-1/4 h-8 w-8 opacity-5 animate-pulse" 
          style={{ animationDelay: "1s" }}
        />
        <Sparkles 
          className="absolute bottom-1/4 left-1/3 h-10 w-10 opacity-5 animate-pulse" 
          style={{ animationDelay: "2s" }}
        />
        <Sparkles 
          className="absolute bottom-1/3 right-1/3 h-12 w-12 opacity-5 animate-pulse" 
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Main content */}
      <div className="relative text-center max-w-2xl px-8">
        {/* Animated icon */}
        <div className="mb-8 flex justify-center">
          <div 
            className="relative"
            style={{ transform: `rotate(${iconRotation}deg)` }}
          >
            <Sparkles 
              className="h-20 w-20" 
              style={{ color: subjectColor }}
            />
            <div 
              className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ backgroundColor: subjectColor }}
            />
          </div>
        </div>

        {/* Message */}
        <h2 
          className="text-3xl font-bold mb-4 animate-fade-in"
          key={message}
        >
          {message}
        </h2>

        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mt-8">
          <div 
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ 
              backgroundColor: subjectColor,
              animationDelay: "0s"
            }}
          />
          <div 
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ 
              backgroundColor: subjectColor,
              animationDelay: "0.2s"
            }}
          />
          <div 
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ 
              backgroundColor: subjectColor,
              animationDelay: "0.4s"
            }}
          />
        </div>

        {/* Tip */}
        <p className="text-sm text-muted-foreground mt-8">
          Great exams start with great questions
        </p>
      </div>
    </div>
  );
}
