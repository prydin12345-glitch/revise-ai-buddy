import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search,
  X,
  ArrowRight,
  Eye,
  Users,
  Plus,
  ChevronDown,
  Calendar,
  Clock,
  GraduationCap,
  FileText,
  Settings,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  TutorDrilldownType,
  StudentGroup,
  StudentItem,
  ExamItem,
  AssignmentItem,
} from "@/hooks/useTutorStatsDrilldown";

// Subtle divider component
const SubtleDivider = () => (
  <div className="h-px bg-border/10 my-4" />
);

// Loading skeleton for list items
const ListSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/10">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    ))}
  </div>
);

// Empty state component
const EmptyState = ({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Icon className="h-12 w-12 text-muted-foreground/50 mb-4" />
    <h4 className="font-medium text-foreground mb-1">{title}</h4>
    <p className="text-sm text-muted-foreground mb-4">{description}</p>
    {action && onAction && (
      <Button onClick={onAction} size="sm">
        <Plus className="h-4 w-4 mr-2" />
        {action}
      </Button>
    )}
  </div>
);

interface TutorStatsDrilldownDrawerProps {
  type: TutorDrilldownType;
  onClose: () => void;
  loading?: boolean;
  groups?: StudentGroup[];
  students?: StudentItem[];
  exams?: ExamItem[];
  assignments?: AssignmentItem[];
}

type GroupSortOption = 'newest' | 'oldest' | 'az';
type StudentSortOption = 'recent' | 'az' | 'za';
type ExamSortOption = 'newest' | 'oldest' | 'most_assigned';
type AssignmentSortOption = 'due_soon' | 'recent';

export const TutorStatsDrilldownDrawer = ({
  type,
  onClose,
  loading = false,
  groups = [],
  students = [],
  exams = [],
  assignments = [],
}: TutorStatsDrilldownDrawerProps) => {
  const navigate = useNavigate();
  
  // Groups state
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSort, setGroupSort] = useState<GroupSortOption>('newest');
  
  // Students state
  const [studentSearch, setStudentSearch] = useState("");
  const [studentGroupFilter, setStudentGroupFilter] = useState<string>("all");
  const [studentSort, setStudentSort] = useState<StudentSortOption>('recent');
  
  // Exams state
  const [examSearch, setExamSearch] = useState("");
  const [examSubjectFilter, setExamSubjectFilter] = useState<string>("all");
  const [examSort, setExamSort] = useState<ExamSortOption>('newest');
  
  // Assignments state
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentGroupFilter, setAssignmentGroupFilter] = useState<string>("all");
  const [assignmentSort, setAssignmentSort] = useState<AssignmentSortOption>('due_soon');

  // Debounced search
  const [debouncedGroupSearch, setDebouncedGroupSearch] = useState("");
  const [debouncedStudentSearch, setDebouncedStudentSearch] = useState("");
  const [debouncedExamSearch, setDebouncedExamSearch] = useState("");
  const [debouncedAssignmentSearch, setDebouncedAssignmentSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedGroupSearch(groupSearch), 300);
    return () => clearTimeout(timer);
  }, [groupSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedStudentSearch(studentSearch), 300);
    return () => clearTimeout(timer);
  }, [studentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedExamSearch(examSearch), 300);
    return () => clearTimeout(timer);
  }, [examSearch]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAssignmentSearch(assignmentSearch), 300);
    return () => clearTimeout(timer);
  }, [assignmentSearch]);

  // Reset state when drawer closes
  useEffect(() => {
    if (!type) {
      setGroupSearch("");
      setStudentSearch("");
      setExamSearch("");
      setAssignmentSearch("");
    }
  }, [type]);

  // Helper to format student display name
  const formatStudentName = (student: StudentItem): string => {
    if (student.first_name) {
      const surnameInitial = student.last_name ? ` ${student.last_name[0]}.` : "";
      const code = student.student_code ? ` (${student.student_code})` : "";
      return `${student.first_name}${surnameInitial}${code}`;
    }
    if (student.display_name && student.display_name !== "Unknown") {
      const code = student.student_code ? ` (${student.student_code})` : "";
      return `${student.display_name}${code}`;
    }
    return student.student_code || "Student";
  };

  // Unique group names for student filter
  const uniqueGroupNames = useMemo(() => {
    return [...new Set(students.map(s => s.group_name))].filter(Boolean);
  }, [students]);

  // Unique subjects for exam filter
  const uniqueSubjects = useMemo(() => {
    return [...new Set(exams.map(e => e.subject_id))].filter(Boolean);
  }, [exams]);

  // Unique groups for assignment filter
  const assignmentGroupNames = useMemo(() => {
    return [...new Set(assignments.map(a => a.group_name).filter(Boolean))];
  }, [assignments]);

  // Filtered and sorted groups
  const filteredGroups = useMemo(() => {
    let result = groups.filter(g =>
      g.name.toLowerCase().includes(debouncedGroupSearch.toLowerCase())
    );
    
    switch (groupSort) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'az':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    
    return result;
  }, [groups, debouncedGroupSearch, groupSort]);

  // Filtered and sorted students
  const filteredStudents = useMemo(() => {
    let result = students.filter(s => {
      const matchesSearch = 
        formatStudentName(s).toLowerCase().includes(debouncedStudentSearch.toLowerCase()) ||
        (s.student_code?.toLowerCase().includes(debouncedStudentSearch.toLowerCase()));
      const matchesGroup = studentGroupFilter === "all" || s.group_name === studentGroupFilter;
      return matchesSearch && matchesGroup;
    });
    
    switch (studentSort) {
      case 'recent':
        result.sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime());
        break;
      case 'az':
        result.sort((a, b) => formatStudentName(a).localeCompare(formatStudentName(b)));
        break;
      case 'za':
        result.sort((a, b) => formatStudentName(b).localeCompare(formatStudentName(a)));
        break;
    }
    
    return result;
  }, [students, debouncedStudentSearch, studentGroupFilter, studentSort]);

  // Filtered and sorted exams
  const filteredExams = useMemo(() => {
    let result = exams.filter(e => {
      const matchesSearch = e.title.toLowerCase().includes(debouncedExamSearch.toLowerCase());
      const matchesSubject = examSubjectFilter === "all" || e.subject_id === examSubjectFilter;
      return matchesSearch && matchesSubject;
    });
    
    switch (examSort) {
      case 'newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most_assigned':
        result.sort((a, b) => b.assigned_count - a.assigned_count);
        break;
    }
    
    return result;
  }, [exams, debouncedExamSearch, examSubjectFilter, examSort]);

  // Filtered and sorted assignments
  const filteredAssignments = useMemo(() => {
    let result = assignments.filter(a => {
      const matchesSearch = a.exam_title.toLowerCase().includes(debouncedAssignmentSearch.toLowerCase());
      const matchesGroup = assignmentGroupFilter === "all" || a.group_name === assignmentGroupFilter;
      return matchesSearch && matchesGroup;
    });
    
    switch (assignmentSort) {
      case 'due_soon':
        result.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }
    
    return result;
  }, [assignments, debouncedAssignmentSearch, assignmentGroupFilter, assignmentSort]);

  const getTitle = () => {
    switch (type) {
      case 'studentGroups':
        return "Student Groups";
      case 'totalStudents':
        return "Students";
      case 'examsCreated':
        return "Exams Created";
      case 'activeAssignments':
        return "Active Assignments";
      default:
        return "";
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'studentGroups':
        return `${groups.length} group${groups.length !== 1 ? 's' : ''}`;
      case 'totalStudents':
        return `${students.length} total student${students.length !== 1 ? 's' : ''}`;
      case 'examsCreated':
        return `${exams.length} total`;
      case 'activeAssignments':
        return `${assignments.length} active`;
      default:
        return "";
    }
  };

  // Render Groups content
  const renderGroupsContent = () => (
    <>
      {/* Controls */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups…"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="shrink-0">
              Sort
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuItem onClick={() => setGroupSort('newest')}>
              Newest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupSort('oldest')}>
              Oldest first
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGroupSort('az')}>
              A–Z
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : filteredGroups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups found"
          description={groupSearch ? "Try a different search term" : "Create your first student group"}
          action={!groupSearch ? "Create group" : undefined}
          onAction={() => navigate("/tutor/students")}
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-2 pr-4">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/10 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{group.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {group.member_count} student{group.member_count !== 1 ? 's' : ''}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(group.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => navigate("/tutor/students")}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Open group</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <SubtleDivider />

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => navigate("/tutor/students")}>
          <Plus className="h-4 w-4 mr-2" />
          Create group
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/tutor/students")}>
          View all groups
        </Button>
      </div>
    </>
  );

  // Render Students content
  const renderStudentsContent = () => (
    <>
      {/* Controls */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            value={studentSearch}
            onChange={(e) => setStudentSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-2">
          <Select value={studentGroupFilter} onValueChange={setStudentGroupFilter}>
            <SelectTrigger className="flex-1 bg-background/50">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All groups</SelectItem>
              {uniqueGroupNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                Sort
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setStudentSort('recent')}>
                Recently added
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStudentSort('az')}>
                Name A–Z
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStudentSort('za')}>
                Name Z–A
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No students found"
          description={studentSearch ? "Try a different search term" : "Students will appear here when they join your groups"}
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-4">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/10 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{formatStudentName(student)}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{student.group_name}</span>
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      onClick={() => navigate(`/tutor/progress`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View student</TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <SubtleDivider />

      {/* Actions */}
      <Button variant="outline" className="w-full" onClick={() => navigate("/tutor/students")}>
        View all students
      </Button>
    </>
  );

  // Render Exams content
  const renderExamsContent = () => (
    <>
      {/* Controls */}
      <div className="space-y-2 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exams…"
            value={examSearch}
            onChange={(e) => setExamSearch(e.target.value)}
            className="pl-9 bg-background/50"
          />
        </div>
        <div className="flex gap-2">
          <Select value={examSubjectFilter} onValueChange={setExamSubjectFilter}>
            <SelectTrigger className="flex-1 bg-background/50">
              <SelectValue placeholder="Filter by subject" />
            </SelectTrigger>
            <SelectContent className="bg-popover">
              <SelectItem value="all">All subjects</SelectItem>
              {uniqueSubjects.map((subject) => (
                <SelectItem key={subject} value={subject}>{subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="shrink-0">
                Sort
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => setExamSort('newest')}>
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExamSort('oldest')}>
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExamSort('most_assigned')}>
                Most assigned
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <ListSkeleton />
      ) : filteredExams.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No exams found"
          description={examSearch ? "Try a different search term" : "Create your first exam to get started"}
          action={!examSearch ? "Create exam" : undefined}
          onAction={() => navigate("/tutor/exams/create")}
        />
      ) : (
        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="space-y-2 pr-4">
            {filteredExams.map((exam) => (
              <div
                key={exam.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/10 hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium truncate">{exam.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">{exam.subject_id}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(exam.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => navigate(`/tutor/exams/${exam.id}/edit`)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Manage exam</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => navigate(`/tutor/exams/${exam.id}/edit`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Preview</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <SubtleDivider />

      {/* Actions */}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => navigate("/tutor/exams/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create exam
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("/tutor/exams")}>
          View all exams
        </Button>
      </div>
    </>
  );

  // Render Assignments content
  const renderAssignmentsContent = () => {
    const getDueBadge = (deadline: string | null) => {
      if (!deadline) {
        return <Badge variant="secondary" className="text-xs">No due date</Badge>;
      }
      const dueDate = new Date(deadline);
      const now = new Date();
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return <Badge variant="destructive" className="text-xs">Overdue</Badge>;
      } else if (diffDays <= 3) {
        return <Badge variant="destructive" className="text-xs">Due in {diffDays} day{diffDays !== 1 ? 's' : ''}</Badge>;
      } else if (diffDays <= 7) {
        return <Badge variant="secondary" className="text-xs">Due in {diffDays} days</Badge>;
      } else {
        return <Badge variant="outline" className="text-xs">{format(dueDate, "MMM d")}</Badge>;
      }
    };

    return (
      <>
        {/* Controls */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assignments…"
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              className="pl-9 bg-background/50"
            />
          </div>
          <div className="flex gap-2">
            <Select value={assignmentGroupFilter} onValueChange={setAssignmentGroupFilter}>
              <SelectTrigger className="flex-1 bg-background/50">
                <SelectValue placeholder="Filter by group" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">All groups</SelectItem>
                {assignmentGroupNames.map((name) => (
                  <SelectItem key={name} value={name!}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="shrink-0">
                  Sort
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setAssignmentSort('due_soon')}>
                  Due soon
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAssignmentSort('recent')}>
                  Recently created
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <ListSkeleton />
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No active assignments"
            description={assignmentSearch ? "Try a different search term" : "Assign an exam to a group to get started"}
            action={!assignmentSearch ? "Create assignment" : undefined}
            onAction={() => navigate("/tutor/exams")}
          />
        ) : (
          <ScrollArea className="h-[calc(100vh-380px)]">
            <div className="space-y-2 pr-4">
              {filteredAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border/10 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{assignment.exam_title}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {assignment.group_name && (
                        <span className="text-xs text-muted-foreground">{assignment.group_name}</span>
                      )}
                      {getDueBadge(assignment.deadline)}
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => navigate(`/tutor/exams/${assignment.exam_id}/dashboard`)}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open dashboard</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <SubtleDivider />

        {/* Actions */}
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => navigate("/tutor/exams")}>
            <Plus className="h-4 w-4 mr-2" />
            Create assignment
          </Button>
          <Button variant="outline" className="flex-1" onClick={() => navigate("/tutor/exams")}>
            View all exams
          </Button>
        </div>
      </>
    );
  };

  const renderContent = () => {
    switch (type) {
      case 'studentGroups':
        return renderGroupsContent();
      case 'totalStudents':
        return renderStudentsContent();
      case 'examsCreated':
        return renderExamsContent();
      case 'activeAssignments':
        return renderAssignmentsContent();
      default:
        return null;
    }
  };

  return (
    <Sheet open={!!type} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-md border-l-border/10 bg-background p-0">
        {/* Header */}
        <div className="p-6 pb-4">
          <SheetHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <SheetTitle className="text-xl font-semibold">{getTitle()}</SheetTitle>
              <p className="text-sm text-muted-foreground mt-1">{getSubtitle()}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetHeader>
        </div>

        <SubtleDivider />

        {/* Content */}
        <div className="px-6 pb-6">
          {renderContent()}
        </div>
      </SheetContent>
    </Sheet>
  );
};
