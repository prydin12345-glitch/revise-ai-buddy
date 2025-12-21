import { AlertTriangle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// List of potentially problematic patterns (non-AI, rule-based)
const PROBLEMATIC_PATTERNS = [
  { pattern: /\b(stupid|dumb|idiot|fool)\b/i, message: "Contains potentially offensive language" },
  { pattern: /\b(wrong|incorrect|bad)\s+(answer|response|work)\b/i, message: "Consider using more constructive phrasing" },
  { pattern: /\b(you\s+should\s+have)\b/i, message: "Consider rephrasing to be less accusatory" },
  { pattern: /\b(obviously|clearly)\b/i, message: "May come across as dismissive" },
  { pattern: /!{2,}/g, message: "Multiple exclamation marks may seem unprofessional" },
  { pattern: /\b(always|never)\s+wrong\b/i, message: "Absolute statements may be discouraging" }
];

// Positive patterns to check for
const POSITIVE_PATTERNS = [
  { pattern: /\b(good|great|well done|excellent|nice)\b/i },
  { pattern: /\b(try|consider|think about|perhaps)\b/i },
  { pattern: /\b(help|assist|support|guide)\b/i },
];

interface ToneCheckResult {
  isOk: boolean;
  warnings: string[];
  hasPositiveElements: boolean;
}

export const checkTone = (text: string): ToneCheckResult => {
  if (!text.trim()) {
    return { isOk: true, warnings: [], hasPositiveElements: false };
  }

  const warnings: string[] = [];
  
  for (const { pattern, message } of PROBLEMATIC_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(message);
    }
  }

  const hasPositiveElements = POSITIVE_PATTERNS.some(({ pattern }) => pattern.test(text));

  return {
    isOk: warnings.length === 0,
    warnings,
    hasPositiveElements
  };
};

interface ToneCheckerDisplayProps {
  result: ToneCheckResult;
  textLength: number;
}

export const ToneCheckerDisplay = ({ result, textLength }: ToneCheckerDisplayProps) => {
  if (textLength < 10) return null;

  if (!result.isOk) {
    return (
      <Alert variant="destructive" className="py-2 mt-2">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Tone suggestions:</strong>
          <ul className="mt-1 list-disc list-inside">
            {result.warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    );
  }

  if (result.hasPositiveElements && textLength > 50) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-600 mt-2">
        <CheckCircle className="h-3.5 w-3.5" />
        Response has a constructive tone
      </div>
    );
  }

  return null;
};
