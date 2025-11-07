import { useEffect, useState } from "react";
import { CheckCircle2, Calculator, FlaskConical, Atom, Dna, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SubmissionLoadingScreenProps {
  subjectName: string;
  subjectColor: string;
  isAutoSubmit?: boolean;
}

const subjectIcons: Record<string, typeof Atom> = {
  chemistry: FlaskConical,
  physics: Atom,
  biology: Dna,
  math: Calculator,
  default: Sparkles,
};

const messages = [
  "🔍 Marking your work...",
  "🧠 Checking answers across all subjects...",
  "📊 Calculating your score...",
  "🎉 Preparing your review page...",
];

export function SubmissionLoadingScreen({ 
  subjectName, 
  subjectColor, 
  isAutoSubmit = false 
}: SubmissionLoadingScreenProps) {
  const [iconRotation, setIconRotation] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  // Rotate icon continuously
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setIconRotation((prev) => (prev + 2) % 360);
    }, 16);

    return () => clearInterval(rotationInterval);
  }, []);

  // Cycle through messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1500);

    return () => clearInterval(messageInterval);
  }, []);

  // Get appropriate icon based on subject name
  const getSubjectIcon = () => {
    const lowerSubject = subjectName.toLowerCase();
    for (const [key, Icon] of Object.entries(subjectIcons)) {
      if (lowerSubject.includes(key)) {
        return Icon;
      }
    }
    return subjectIcons.default;
  };

  const SubjectIcon = getSubjectIcon();

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
        {/* Auto-Submit Badge */}
        {isAutoSubmit && (
          <Badge 
            variant="destructive" 
            className="mb-8 text-sm px-4 py-2 animate-fade-in"
          >
            ⏰ Auto-Submitted — Time's Up!
          </Badge>
        )}

        {/* Animated icon with glow */}
        <div className="mb-8 flex justify-center">
          <div 
            className="relative"
            style={{ transform: `rotate(${iconRotation}deg)` }}
          >
            <SubjectIcon 
              className="h-20 w-20" 
              style={{ color: subjectColor }}
            />
            <div 
              className="absolute inset-0 rounded-full blur-2xl opacity-30"
              style={{ backgroundColor: subjectColor }}
            />
          </div>
        </div>

        {/* Dynamic message */}
        <h2 
          className="text-3xl font-bold mb-4 animate-fade-in text-white"
          key={currentMessageIndex}
        >
          {messages[currentMessageIndex]}
        </h2>

        {/* Progress dots */}
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

        {/* Reassuring message */}
        <p className="text-sm text-muted-foreground mt-8 animate-fade-in">
          This should only take a few seconds...
        </p>
      </div>
    </div>
  );
}
