import { useState, useEffect } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface FillInBlankRendererProps {
  content: string;
  questionId: string;
  answers: Record<string, string>;
  onAnswerChange: (blankId: string, value: string) => void;
  readOnly?: boolean;
  subjectColor?: string;
}

// Pattern to detect [ BLANK ] placeholders (case insensitive, allows spaces)
const BLANK_PATTERN = /\[\s*BLANK\s*\]/gi;

// Pattern to detect underscore-style blanks (5+ underscores)
const UNDERSCORE_BLANK_PATTERN = /_{5,}/g;

// Pattern to detect backslash-style blanks (5+ backslashes, with or without underscores)
// Matches: \\\\\\, \\_\\_\\_, L\\L\\L (common OCR artifacts)
const BACKSLASH_BLANK_PATTERN = /(?:[\\\/L_]{5,}|(?:[\\\/L]+[_\\\/L]*){5,})/g;

// Pattern for LaTeX-style underline commands
const LATEX_UNDERLINE_PATTERN = /\\underline\{[^}]*\}/g;

// Convert various blank formats to standardized [ BLANK ] format
const normalizeBlankFormat = (content: string): string => {
  let normalized = content;
  
  // Replace backslash patterns first (most common issue from OCR/generation)
  normalized = normalized.replace(BACKSLASH_BLANK_PATTERN, '[ BLANK ]');
  
  // Replace underscore patterns
  normalized = normalized.replace(UNDERSCORE_BLANK_PATTERN, '[ BLANK ]');
  
  // Replace LaTeX underline commands
  normalized = normalized.replace(LATEX_UNDERLINE_PATTERN, '[ BLANK ]');
  
  // Clean up any double spaces created
  normalized = normalized.replace(/\[\s*BLANK\s*\]\s*\[\s*BLANK\s*\]/g, '[ BLANK ]');
  
  return normalized;
};

// Check if content has fill-in-the-blank placeholders
export const hasFillInBlanks = (content: string): boolean => {
  // Check for existing [ BLANK ] placeholders
  if (BLANK_PATTERN.test(content)) return true;
  
  // Check for underscore patterns
  if (UNDERSCORE_BLANK_PATTERN.test(content)) return true;
  
  // Check for backslash patterns
  if (BACKSLASH_BLANK_PATTERN.test(content)) return true;
  
  // Check for LaTeX underline
  if (LATEX_UNDERLINE_PATTERN.test(content)) return true;
  
  return false;
};

// Count the number of blanks in content
export const countBlanks = (content: string): number => {
  const normalized = normalizeBlankFormat(content);
  const matches = normalized.match(BLANK_PATTERN);
  return matches ? matches.length : 0;
};

export function FillInBlankRenderer({
  content,
  questionId,
  answers,
  onAnswerChange,
  readOnly = false,
  subjectColor = '#6366f1'
}: FillInBlankRendererProps) {
  // Normalize the content to use standardized [ BLANK ] format
  const normalizedContent = normalizeBlankFormat(content);
  
  // Split content by blanks and math expressions
  const renderContent = () => {
    let blankIndex = 0;
    
    // First, split by [ BLANK ] placeholders
    const parts = normalizedContent.split(BLANK_PATTERN);
    const blanksCount = countBlanks(normalizedContent);
    
    const elements: React.ReactNode[] = [];
    
    parts.forEach((part, partIndex) => {
      // Process this part for math expressions
      const mathParts = part.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/g);
      
      mathParts.forEach((mathPart, mathIndex) => {
        if (mathPart.startsWith('$$') && mathPart.endsWith('$$')) {
          // Block math
          const mathContent = mathPart.slice(2, -2);
          elements.push(
            <span key={`math-block-${partIndex}-${mathIndex}`} className="mx-1">
              <InlineMath math={mathContent} />
            </span>
          );
        } else if (mathPart.startsWith('$') && mathPart.endsWith('$')) {
          // Inline math
          const mathContent = mathPart.slice(1, -1);
          elements.push(
            <InlineMath key={`math-inline-${partIndex}-${mathIndex}`} math={mathContent} />
          );
        } else if (mathPart.trim()) {
          // Regular text - preserve line breaks
          const lines = mathPart.split('\n');
          lines.forEach((line, lineIndex) => {
            if (line) {
              elements.push(
                <span key={`text-${partIndex}-${mathIndex}-${lineIndex}`}>{line}</span>
              );
            }
            if (lineIndex < lines.length - 1) {
              elements.push(<br key={`br-${partIndex}-${mathIndex}-${lineIndex}`} />);
            }
          });
        }
      });
      
      // Add a blank input after this part (except after the last part)
      if (partIndex < blanksCount) {
        const blankId = `blank_${blankIndex}`;
        const currentValue = answers[blankId] || '';
        
        elements.push(
          <span key={`blank-wrapper-${blankIndex}`} className="inline-flex items-center mx-1">
            {readOnly ? (
              <span 
                className="inline-block min-w-[100px] px-2 py-0.5 border-b-2 text-center font-medium"
                style={{ borderColor: subjectColor, color: subjectColor }}
              >
                {currentValue || '[ BLANK ]'}
              </span>
            ) : (
              <input
                type="text"
                value={currentValue}
                onChange={(e) => onAnswerChange(blankId, e.target.value)}
                placeholder="answer"
                className="inline-block min-w-[100px] max-w-[200px] px-2 py-0.5 text-center border-b-2 border-dashed bg-transparent focus:outline-none focus:border-solid transition-all text-sm font-medium"
                style={{ 
                  borderColor: currentValue ? subjectColor : 'hsl(var(--muted-foreground))',
                  color: 'hsl(var(--foreground))'
                }}
                autoComplete="off"
                spellCheck={false}
              />
            )}
          </span>
        );
        
        blankIndex++;
      }
    });
    
    return elements;
  };

  return (
    <div className="prose prose-sm max-w-none leading-relaxed">
      <div className="text-base leading-7">
        {renderContent()}
      </div>
    </div>
  );
}

export default FillInBlankRenderer;
