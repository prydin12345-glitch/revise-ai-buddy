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
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="container max-w-7xl mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>
        </div>

        {/* Horizontal Tabs Navigation */}
        <div className="sticky top-[73px] z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
          <div className="container max-w-7xl mx-auto px-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start h-auto bg-transparent border-0 p-0 flex-wrap">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="gap-2 px-4 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent hover:text-foreground transition-colors"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Content */}
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="account" className="mt-0">
              <AccountSection />
            </TabsContent>
            <TabsContent value="personalization" className="mt-0">
              <PersonalizationSection />
            </TabsContent>
            <TabsContent value="privacy" className="mt-0">
              <PrivacySection />
            </TabsContent>
            <TabsContent value="ai" className="mt-0">
              <AIUsageSection />
            </TabsContent>
            <TabsContent value="integrations" className="mt-0">
              <IntegrationsSection />
            </TabsContent>
            <TabsContent value="advanced" className="mt-0">
              <AdvancedSection />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
