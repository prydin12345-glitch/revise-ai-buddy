// src/components/dashboard/Topbar.tsx
import {
  Search, Link2, Plus, ChevronDown, Bell, FileText, ListChecks, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface TopbarProps {
  initials: string;
  onCreateExam?: () => void;
  onCreateQuiz?: () => void;
  onCreateClass?: () => void;
  onJoinClass?: () => void;
}

export default function Topbar({
  initials, onCreateExam, onCreateQuiz, onCreateClass, onJoinClass,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/70 px-6 py-3.5 backdrop-blur lg:px-8">
      {/* brand */}
      <div className="flex items-center gap-3">
        <div className="grid h-8 w-8 place-items-center rounded-[9px] bg-primary text-base font-extrabold text-primary-foreground shadow-lg shadow-primary/30">
          E
        </div>
        <div className="text-[19px] font-extrabold tracking-tight">
          Exam<span className="text-primary">ly</span>
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-border" />
      <div className="text-sm font-bold">Dashboard</div>

      {/* search */}
      <div className="ml-1.5 hidden w-[280px] items-center gap-2.5 rounded-[11px] border border-border bg-panel px-3.5 py-2 text-muted-foreground md:flex">
        <Search className="h-4 w-4" />
        <input
          placeholder="Search exams, quizzes, classes…"
          className="w-full bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {/* right */}
      <div className="ml-auto flex items-center gap-3">
        <Button
          variant="outline"
          onClick={onJoinClass}
          className="hidden h-10 gap-2 rounded-[11px] border-border bg-panel text-[13.5px] font-semibold hover:bg-surface-hover sm:flex"
        >
          <Link2 className="h-4 w-4" /> Join Class
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="h-10 gap-2 rounded-[11px] bg-primary text-[13.5px] font-bold text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Create
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60 rounded-2xl border-border bg-popover p-1.5">
            <CreateRow icon={<FileText className="h-[18px] w-[18px]" />} tint="text-primary" bg="bg-primary/15"
              title="Mock Exam" sub="Full timed paper" onClick={onCreateExam} />
            <CreateRow icon={<ListChecks className="h-[18px] w-[18px]" />} tint="text-success" bg="bg-success/15"
              title="Practice Question" sub="Quick drill or quiz" onClick={onCreateQuiz} />
            <DropdownMenuSeparator className="my-1.5 bg-border" />
            <CreateRow icon={<Users className="h-[18px] w-[18px]" />} tint="text-[#a78bfa]" bg="bg-[#a78bfa]/15"
              title="New Class" sub="Invite your students" onClick={onCreateClass} />
          </DropdownMenuContent>
        </DropdownMenu>

        <button className="relative grid h-10 w-10 place-items-center rounded-[11px] border border-border bg-panel text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground">
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full border-2 border-panel bg-danger" />
        </button>

        <button className="grid h-10 w-10 place-items-center rounded-[11px] bg-primary text-sm font-extrabold text-primary-foreground">
          {initials}
        </button>
      </div>
    </header>
  );
}

function CreateRow({
  icon, tint, bg, title, sub, onClick,
}: {
  icon: React.ReactNode; tint: string; bg: string;
  title: string; sub: string; onClick?: () => void;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      className="flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 focus:bg-surface-hover"
    >
      <span className={`grid h-9 w-9 flex-none place-items-center rounded-[10px] ${bg} ${tint}`}>
        {icon}
      </span>
      <span>
        <span className="block text-[13.5px] font-bold">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
    </DropdownMenuItem>
  );
}
