import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Palette, Shield, Brain, Link2, Settings as SettingsIcon } from "lucide-react";
import { AccountSection } from "@/components/settings/sections/AccountSection";
import { PersonalizationSection } from "@/components/settings/sections/PersonalizationSection";
import { PrivacySection } from "@/components/settings/sections/PrivacySection";
import { AIUsageSection } from "@/components/settings/sections/AIUsageSection";
import { IntegrationsSection } from "@/components/settings/sections/IntegrationsSection";
import { AdvancedSection } from "@/components/settings/sections/AdvancedSection";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("account");

  const tabs = [
    { id: "account", label: "Account", icon: User },
    { id: "personalization", label: "Personalization", icon: Palette },
    { id: "privacy", label: "Privacy & Security", icon: Shield },
    { id: "ai", label: "AI Usage", icon: Brain },
    { id: "integrations", label: "Integrations", icon: Link2 },
    { id: "advanced", label: "Advanced", icon: SettingsIcon },
  ];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Header + Tabs (single sticky block) */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
            <div className="container max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 pb-0">
              <div className="flex flex-col gap-1 mb-4 sm:mb-5">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  Settings
                </h1>
                <p className="hidden sm:block text-sm text-muted-foreground">
                  Manage your account, preferences, and integrations
                </p>
              </div>

              {/* Horizontally scrollable tab strip on mobile */}
              <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-none">
                <TabsList className="w-max sm:w-full justify-start h-auto bg-transparent border-0 p-0 px-4 sm:px-0 gap-1 flex-nowrap">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="shrink-0 gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-none border-b-2 border-transparent text-sm font-medium text-muted-foreground data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </div>
          </div>

          {/* Content */}
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
            <TabsContent value="integrations" className="mt-0 focus-visible:outline-none">
              <IntegrationsSection />
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
