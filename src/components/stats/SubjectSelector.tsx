import type { CSSProperties } from "react";
import type { StatsSubject } from "@/lib/subject-profile-stats";

function subjectColour(value: string) {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.test(value) ? value : "#4263eb";
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map(char => char + char).join("")}` : hex;
  const rgb = [1, 3, 5].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
  const linear = rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  // Black/white foreground selection keeps even custom bright subject colours readable.
  return { colour: full, foreground: luminance > .179 ? "#000000" : "#ffffff" };
}

export function SubjectSelector({ subjects, selectedId, onSelect }: {
  subjects: StatsSubject[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const active = subjectColour(subjects.find(subject => subject.id === selectedId)?.color || "");
  return <div className="subject-stats-subject-switch" role="group" aria-label="Subject"
    style={{ "--active-subject-colour": active.colour } as CSSProperties}>
    {subjects.map(subject => {
      const { colour, foreground } = subjectColour(subject.color);
      return <button key={subject.id} type="button" aria-pressed={subject.id === selectedId}
        style={{ "--subject-tab-colour": colour, "--subject-tab-foreground": foreground } as CSSProperties}
        onClick={() => onSelect(subject.id)}>{subject.name}</button>;
    })}
  </div>;
}
