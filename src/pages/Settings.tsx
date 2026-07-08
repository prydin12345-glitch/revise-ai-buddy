import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  SettingsSidebar,
  SETTINGS_GROUPS,
  SETTINGS_META,
  type SettingsTabId,
} from "@/components/settings/SettingsSidebar";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { PersonalizationSection } from "@/components/settings/sections/PersonalizationSection";
import { PrivacySection } from "@/components/settings/sections/PrivacySection";
import { AIUsageSection } from "@/components/settings/sections/AIUsageSection";
import { AdvancedSection } from "@/components/settings/sections/AdvancedSection";

const VALID_TABS: SettingsTabId[] = [
  "account",
  "personalization",
  "advanced",
  "privacy",
  "ai",
];

const useIsLg = () => {
  const [isLg, setIsLg] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsLg(mql.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  return isLg;
};

const renderSection = (tab: SettingsTabId) => {
  switch (tab) {
    case "account":
      return <AccountSection />;
    case "personalization":
      return <PersonalizationSection />;
    case "advanced":
      return <AdvancedSection />;
    case "privacy":
      return <PrivacySection />;
    case "ai":
      return <AIUsageSection />;
  }
};

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isLg = useIsLg();

  const tabParam = searchParams.get("tab") as SettingsTabId | null;
  const activeTab: SettingsTabId | null = VALID_TABS.includes(tabParam as SettingsTabId)
    ? (tabParam as SettingsTabId)
    : null;

  // Desktop always shows a section (default account); mobile shows index if no tab.
  const effectiveTab: SettingsTabId | null = isLg ? activeTab ?? "account" : activeTab;

  const setTab = (id: SettingsTabId) => setSearchParams({ tab: id }, { replace: false });
  const clearTab = () => setSearchParams({}, { replace: false });

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {isLg ? (
          // ─── Desktop: sidebar + focused content pane ─────────────────────
          <div className="mx-auto max-w-5xl px-6 flex gap-6">
            <SettingsSidebar
              active={effectiveTab ?? "account"}
              onSelect={setTab}
            />
            <main className="flex-1 min-w-0 py-8">
              <div className="max-w-2xl">
                <SectionHeader tab={effectiveTab ?? "account"} />
                <div className="mt-8">{renderSection(effectiveTab ?? "account")}</div>
              </div>
            </main>
          </div>
        ) : effectiveTab ? (
          // ─── Mobile: drilled-down section ────────────────────────────────
          <main className="px-4 pt-4 pb-16">
            <button
              type="button"
              onClick={clearTab}
              className="inline-flex items-center gap-1.5 -ml-1 mb-4 text-sm text-muted-foreground hover:text-foreground min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4" />
              Settings
            </button>
            <SectionHeader tab={effectiveTab} />
            <div className="mt-6">{renderSection(effectiveTab)}</div>
          </main>
        ) : (
          // ─── Mobile: index / drill-down menu ─────────────────────────────
          <main className="px-4 pt-6 pb-16">
            <h1 className="text-xl font-semibold tracking-tight text-foreground mb-6">
              Settings
            </h1>
            <div className="space-y-6">
              {SETTINGS_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="px-1 mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setTab(item.id)}
                        className="w-full flex items-center justify-between px-4 py-4 text-left min-h-[56px] hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {item.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {SETTINGS_META[item.id].description}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 ml-3" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </main>
        )}
      </div>
    </DashboardLayout>
  );
};

const SectionHeader = ({ tab }: { tab: SettingsTabId }) => {
  const meta = SETTINGS_META[tab];
  return (
    <header>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {meta.title}
      </h2>
      <p className="text-xs text-muted-foreground mt-1">{meta.description}</p>
    </header>
  );
};

export default Settings;
