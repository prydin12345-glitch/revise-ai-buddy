import { useCallback, RefObject } from 'react';

interface UseTextareaInsertOptions {
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
  onChange: (newValue: string) => void;
}

export function useTextareaInsert({ textareaRef, value, onChange }: UseTextareaInsertOptions) {
  // Insert text at current cursor position, replacing selection if any
  const insertAtCursor = useCallback((textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    // Create new value with insertion
    const before = value.substring(0, start);
    const after = value.substring(end);
    const newValue = before + textToInsert + after;
    
    // Update value
    onChange(newValue);
    
    // Restore focus and set cursor position after the inserted text
    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + textToInsert.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, [textareaRef, value, onChange]);

  // Move cursor left or right
  const moveCursor = useCallback((direction: 'left' | 'right') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const currentPos = textarea.selectionStart;
    const newPos = direction === 'left' 
      ? Math.max(0, currentPos - 1)
      : Math.min(value.length, currentPos + 1);
    
    textarea.focus();
    textarea.setSelectionRange(newPos, newPos);
  }, [textareaRef, value]);

  // Delete character before cursor (backspace)
  const deleteAtCursor = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start === end && start > 0) {
      // No selection - delete character before cursor
      const before = value.substring(0, start - 1);
      const after = value.substring(end);
      onChange(before + after);
      
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start - 1, start - 1);
      });
    } else if (start !== end) {
      // Selection exists - delete selection
      const before = value.substring(0, start);
      const after = value.substring(end);
      onChange(before + after);
      
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start);
      });
    }
  }, [textareaRef, value, onChange]);

  return {
    insertAtCursor,
    moveCursor,
    deleteAtCursor,
  };
}
