import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LibrarySubjectShelf({ subject, color, count, children }: { subject: string; color: string; count: number; children: ReactNode }) {
  const row = useRef<HTMLDivElement>(null);
  const id = useId();
  const [edges, setEdges] = useState({ start: true, end: true });
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () => {
      const next = { start: element.scrollLeft < 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 };
      setEdges(previous => previous.start === next.start && previous.end === next.end ? previous : next);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer?.disconnect(); element.removeEventListener("scroll", update); };
  }, [count]);
  const scroll = (direction: number) => {
    const element = row.current;
    if (element) element.scrollBy({ left: direction * (element.clientWidth - 36), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <section aria-label={subject} className="library-subject-shelf">
      <div className="library-subject-heading">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <h2 className="min-w-0 truncate font-semibold">{subject}</h2>
        <span className="library-subject-count">{count}</span>
        <div className="library-shelf-arrows">
          <Button variant="outline" size="icon" disabled={edges.start} onClick={() => scroll(-1)} aria-controls={id} aria-label={`Previous ${subject} papers`}><ChevronLeft aria-hidden="true" className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" disabled={edges.end} onClick={() => scroll(1)} aria-controls={id} aria-label={`Next ${subject} papers`}><ChevronRight aria-hidden="true" className="h-4 w-4" /></Button>
        </div>
      </div>
      <div ref={row} id={id} tabIndex={0} aria-label={`Scroll ${subject} papers`} data-scroll-restoration={subject} className="library-subject-row">{children}</div>
    </section>
  );
}
