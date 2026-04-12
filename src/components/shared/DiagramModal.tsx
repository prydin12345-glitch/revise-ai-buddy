import React, { useEffect, useCallback, useState } from 'react';
import { X, ZoomIn } from 'lucide-react';

interface DiagramModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const DiagramModal: React.FC<DiagramModalProps> = ({
  open,
  onClose,
  title = 'Figure',
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    } else {
      setAnimating(false);
      const timer = setTimeout(() => setVisible(false), 200);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, handleKey]);

  if (!visible) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-out',
        padding: 'env(safe-area-inset-top, 0) env(safe-area-inset-right, 0) env(safe-area-inset-bottom, 0) env(safe-area-inset-left, 0)',
        opacity: animating ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="diagram-modal-panel"
        style={{
          background: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: 12,
          width: 'min(88vw, 1100px)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          cursor: 'default',
          boxShadow: '0 8px 40px rgba(0,0,0,0.35)',
          transform: animating ? 'scale(1)' : 'scale(0.92)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid hsl(var(--border))',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            {title}
          </span>

          <button
            onClick={onClose}
            aria-label="Close diagram"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'hsl(var(--muted-foreground))',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = 'hsl(var(--muted))')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = 'transparent')
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* Diagram content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 900 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

/** Small zoom-in hint shown on the inline diagram */
export const ZoomHint: React.FC = () => (
  <div
    className="zoom-hint"
    style={{
      position: 'absolute',
      bottom: 8,
      right: 10,
      opacity: 0,
      transition: 'opacity 0.2s',
      pointerEvents: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 10,
      color: 'hsl(var(--muted-foreground))',
    }}
  >
    <ZoomIn size={13} />
    <span>Enlarge</span>
  </div>
);

export default DiagramModal;
