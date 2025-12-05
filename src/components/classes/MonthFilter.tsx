import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addMonths } from "date-fns";

interface MonthFilterProps {
  value: Date;
  onChange: (date: Date) => void;
}

export const MonthFilter = ({ value, onChange }: MonthFilterProps) => {
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = addMonths(new Date(new Date().getFullYear(), 0, 1), i);
    return { value: i.toString(), label: format(date, "MMMM"), date };
  });

  return (
    <Select
      value={value.getMonth().toString()}
      onValueChange={(v) => onChange(new Date(value.getFullYear(), parseInt(v), 1))}
    >
      <SelectTrigger className="w-[140px] bg-card border-border">
        <SelectValue placeholder="Select month" />
      </SelectTrigger>
      <SelectContent>
        {months.map((month) => (
          <SelectItem key={month.value} value={month.value}>
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
