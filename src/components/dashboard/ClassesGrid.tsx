import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ClassInfo {
  id: string;
  name: string;
  tutorName: string;
  studentCount: number;
  color: string;
}

interface Props {
  classes: ClassInfo[];
  onJoinClass: () => void;
}

export const ClassesGrid = ({ classes, onJoinClass }: Props) => {
  const navigate = useNavigate();

  return (
    <Card className="rounded-2xl border-border/50 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">My Classes</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onJoinClass}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Join
          </Button>
          <Button
            variant="link"
            size="sm"
            className="text-primary text-xs p-0 h-auto"
            onClick={() => navigate("/my-classes")}
          >
            View all
          </Button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-xl">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground mb-3">You haven't joined any classes yet.</p>
          <Button size="sm" variant="outline" onClick={onJoinClass}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Join a class
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {classes.slice(0, 4).map((cls) => (
            <button
              key={cls.id}
              onClick={() => navigate(`/my-classes?classId=${cls.id}`)}
              className="group text-left rounded-xl border border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all p-4 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: cls.color }}
                  />
                  <span className="text-sm font-semibold text-foreground truncate">
                    {cls.name}
                  </span>
                </div>
                <ChevronRight
                  size={16}
                  className="text-muted-foreground group-hover:text-primary transition-colors shrink-0"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{cls.tutorName}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <Users size={11} />
                  {cls.studentCount}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
};
