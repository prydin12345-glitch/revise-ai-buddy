import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fuzzyMatch, getLocalSubtopics } from "@/lib/subtopic-dictionary";

interface TopicSearchInputProps {
  subjectName: string;
  existingTopics: string[];
  onAddTopic: (topic: string) => void;
  placeholder?: string;
  className?: string;
}

export const TopicSearchInput = ({
  subjectName,
  existingTopics,
  onAddTopic,
  placeholder = "Search & add topic...",
  className,
}: TopicSearchInputProps) => {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const dictionaryTopics = useMemo(
    () => getLocalSubtopics(subjectName),
    [subjectName]
  );

  const filteredTopics = useMemo(() => {
    const available = dictionaryTopics.filter(
      (t) => !existingTopics.some((e) => e.toLowerCase() === t.toLowerCase())
    );
    if (!searchValue.trim()) return available.slice(0, 30);
    return available.filter((t) => fuzzyMatch(searchValue, t));
  }, [dictionaryTopics, existingTopics, searchValue]);

  const isCustom =
    searchValue.trim() &&
    !dictionaryTopics.some(
      (t) => t.toLowerCase() === searchValue.trim().toLowerCase()
    ) &&
    !existingTopics.some(
      (t) => t.toLowerCase() === searchValue.trim().toLowerCase()
    );

  const handleSelect = (topic: string) => {
    onAddTopic(topic);
    setSearchValue("");
    setOpen(false);
  };

  const handleAddCustom = () => {
    if (searchValue.trim()) {
      onAddTopic(searchValue.trim());
      setSearchValue("");
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between h-9 text-sm font-normal", className)}
        >
          <span className="text-muted-foreground truncate">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          {filteredTopics.length === 0 && !isCustom && (
            <CommandEmpty>No topics found.</CommandEmpty>
          )}
          <CommandGroup className="max-h-52 overflow-y-auto">
            {isCustom && (
              <CommandItem onSelect={handleAddCustom} className="gap-2">
                <Plus className="h-3.5 w-3.5 text-primary" />
                <span>
                  Add "<span className="font-medium">{searchValue.trim()}</span>"
                </span>
              </CommandItem>
            )}
            {filteredTopics.map((topic) => (
              <CommandItem
                key={topic}
                value={topic}
                onSelect={() => handleSelect(topic)}
              >
                <Check
                  className={cn(
                    "mr-2 h-3.5 w-3.5",
                    existingTopics.includes(topic)
                      ? "opacity-100"
                      : "opacity-0"
                  )}
                />
                {topic}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
