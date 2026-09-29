import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ExamProfileCard } from "./ExamProfileCard";

interface ExamProfileCarouselProps {
  profiles: any[];
  subjectName: string;
  subjectColor?: string | null;
  onEdit: (profile: any) => void;
}

const CARD_WIDTH = 300;

/**
 * A horizontally-scrolling row instead of a wrapping grid, so a subject with
 * ten profiles stays one row tall instead of growing the page downward.
 * Arrows scroll by one card-width and hide themselves once there's nothing
 * left in that direction — including hiding entirely when everything already
 * fits (e.g. two or three profiles on a wide screen), rather than showing a
 * pair of arrows that do nothing.
 */
export const ExamProfileCarousel = ({
  profiles, subjectName, subjectColor, onEdit,
}: ExamProfileCarouselProps) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [updateArrows, profiles.length]);

  const scrollBy = (dir: 1 | -1) => {
    scrollerRef.current?.scrollBy({ left: dir * (CARD_WIDTH + 12), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {canLeft && (
        <button
          type="button"
          onClick={() => scrollBy(-1)}
          aria-label="Scroll profiles left"
          className="hidden sm:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong shadow-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-1 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {profiles.map((profile) => (
          <div key={profile.id} className="shrink-0 snap-start" style={{ width: CARD_WIDTH }}>
            <ExamProfileCard
              profile={profile}
              subjectName={subjectName}
              subjectColor={subjectColor}
              onEdit={() => onEdit(profile)}
            />
          </div>
        ))}
      </div>

      {canRight && (
        <button
          type="button"
          onClick={() => scrollBy(1)}
          aria-label="Scroll profiles right"
          className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border-strong shadow-sm transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
