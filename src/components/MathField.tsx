import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import 'mathlive';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

interface MathFieldProps {
  value: string;
  onChange: (latex: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
}

export const MathField = forwardRef(function MathField({
  value, 
  onChange, 
  onFocus, 
  onBlur,
  placeholder,
  className 
}: MathFieldProps, ref) {
  const mfRef = useRef<any>(null);

  // Expose mathfield instance to parent via ref
  useImperativeHandle(ref, () => ({
    executeCommand: (command: any) => {
      if (mfRef.current) {
        mfRef.current.executeCommand(command);
      }
    },
    focus: () => {
      if (mfRef.current) {
        mfRef.current.focus();
      }
    }
  }));

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    // Completely disable MathLive's native UI elements
    mf.mathVirtualKeyboardPolicy = 'off';
    
    // Disable smart mode (no text/math toggle) and clean up UI
    mf.smartMode = false;
    mf.defaultMode = 'math';
    
    // Hide all menu items (Insert, Mode, Font, Color, etc.)
    mf.menuItems = [];
    
    // Set inline shortcuts directly on mathfield (modern API)
    mf.inlineShortcuts = {
      half: '\\frac{1}{2}',
      quarter: '\\frac{1}{4}',
      third: '\\frac{1}{3}',
      degrees: '^{\\circ}',
      squared: '^{2}',
      cubed: '^{3}',
      space: '\\space',
    };

    // Enable physical keyboard shortcuts - let default behavior handle most keys
    // Only override Space to insert space character instead of navigation
    mf.keybindings = [
      { key: 'Space', ifMode: 'math', command: ['insert', ' '] },
    ];

    // Set initial value
    if (value && mf.value !== value) {
      mf.value = value;
    }

    // Handle input changes
    const handleInput = (evt: any) => {
      onChange(evt.target.value);
    };

    mf.addEventListener('input', handleInput);

    return () => {
      mf.removeEventListener('input', handleInput);
    };
  }, [value, onChange]);

  return (
    <math-field
      ref={mfRef}
      onFocus={onFocus}
      onBlur={onBlur}
      className={className}
      style={{
        display: 'block',
        minHeight: '60px',
        padding: '8px 12px',
        border: '1px solid hsl(var(--border))',
        borderRadius: '6px',
        fontSize: '16px',
        fontFamily: 'inherit',
        backgroundColor: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
      }}
    >
      {value || ''}
    </math-field>
  );
});
