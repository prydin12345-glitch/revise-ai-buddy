import { cn } from "@/lib/utils";
import {
  User,
  Palette,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type SettingsTabId =
  | "account"
  | "personalization"
  | "advanced"
  | "privacy"
  | "ai";

export const SETTINGS_GROUPS: {
  label: string;
  items: { id: SettingsTabId; label: string; icon: LucideIcon }[];
}[] = [
  {
    label: "Personal",
    items: [
      { id: "account", label: "Account", icon: User },
      { id: "personalization", label: "Personalization", icon: Palette },
      { id: "advanced", label: "Advanced", icon: SlidersHorizontal },
    ],
  },
  {
    label: "Data & AI",
    items: [
      { id: "privacy", label: "Privacy & Security", icon: ShieldCheck },
      { id: "ai", label: "AI Usage", icon: Sparkles },
    ],
  },
];

export const SETTINGS_META: Record<
  SettingsTabId,
  { title: string; description: string }
> = {
  account: {
    title: "Account",
    description: "Your profile, name, and sign-in details.",
  },
  personalization: {
    title: "Personalization",
    description: "Curriculum, exam boards, and defaults for new subjects.",
  },
  advanced: {
    title: "Advanced",
    description: "Accessibility and display options.",
  },
  privacy: {
    title: "Privacy & Security",
    description: "Cookies, data export, and legal.",
  },
  ai: {
    title: "AI Usage",
    description: "Feedback style and your monthly usage.",
  },
};

interface SettingsSidebarProps {
  active: SettingsTabId;
  onSelect: (id: SettingsTabId) => void;
}

export const SettingsSidebar = ({ active, onSelect }: SettingsSidebarProps) => {
  return (
    <nav
      aria-label="Settings"
      className="sticky top-6 self-start pr-2"
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      <div className="space-y-6">
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = item.id === active;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2.5 text-left rounded-md pl-3 pr-2 py-2 text-sm transition-colors relative border-l-2",
                        isActive
                          ? "bg-muted/60 text-foreground font-medium border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-transparent",
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )}
                        strokeWidth={2}
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
};

