import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Palette, Shield, Brain, Settings as SettingsIcon } from "lucide-react";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { PersonalizationSection } from "@/components/settings/sections/PersonalizationSection";
import { PrivacySection } from "@/components/settings/sections/PrivacySection";
import { AIUsageSection } from "@/components/settings/sections/AIUsageSection";
import { AdvancedSection } from "@/components/settings/sections/AdvancedSection";

const VALID_TABS = ["account", "personalization", "privacy", "ai", "advanced"] as const;

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = (VALID_TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as string)
    : "account";

  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: false });
  };

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "personalization", label: "Personalization", icon: Palette },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
    { id: "ai", label: "AI Usage", icon: Brain },
    { id: "advanced", label: "Advanced", icon: SettingsIcon },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
            <div className="container max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-4">
              <div className="flex flex-col gap-1 mb-4 sm:mb-5">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Settings
                </h1>
                <p className="hidden sm:block text-sm text-muted-foreground">
                  Manage your account, preferences, and integrations
                </p>
              </div>

              <div className="relative">
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden z-10" />
                <div className="-mx-1 overflow-x-auto scrollbar-none">
                  <TabsList className="w-max sm:w-full flex gap-1 bg-muted/40 p-1 rounded-xl h-auto">
                    {tabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <TabsTrigger
                          key={tab.id}
                          value={tab.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition-all text-muted-foreground data-[state=active]:bg-card data-[state=active]:shadow-sm data-[state=active]:text-foreground hover:text-foreground"
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{tab.label}</span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                </div>
              </div>
            </div>
          </div>

          <div className="container max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <TabsContent value="account" className="mt-0 focus-visible:outline-none">
              <AccountSection />
            </TabsContent>
            <TabsContent value="personalization" className="mt-0 focus-visible:outline-none">
              <PersonalizationSection />
            </TabsContent>
            <TabsContent value="privacy" className="mt-0 focus-visible:outline-none">
              <PrivacySection />
            </TabsContent>
            <TabsContent value="ai" className="mt-0 focus-visible:outline-none">
              <AIUsageSection />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0 focus-visible:outline-none">
              <AdvancedSection />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
