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
            <p className="text-muted-foreground mt-1">Manage your account preferences and application settings</p>
          </div>
        </div>

        {/* Content */}
        <div className="container max-w-7xl mx-auto px-4 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
            {/* Desktop: Side-by-side layout */}
            <div className="hidden lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
              {/* Sidebar */}
              <div className="space-y-1">
                <TabsList className="flex flex-col h-auto bg-transparent space-y-1 p-0">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.id}
                        value={tab.id}
                        className="w-full justify-start gap-3 px-4 py-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>

              {/* Content */}
              <div className="space-y-6">
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
              </div>
            </div>

            {/* Mobile: Top tabs */}
            <div className="lg:hidden space-y-6">
              <TabsList className="w-full grid grid-cols-3 gap-2 bg-muted/50 p-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="flex flex-col gap-1 py-2 data-[state=active]:bg-background"
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs">{tab.label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <div className="space-y-6">
                <TabsContent value="account">
                  <AccountSection />
                </TabsContent>
                <TabsContent value="personalization">
                  <PersonalizationSection />
                </TabsContent>
                <TabsContent value="privacy">
                  <PrivacySection />
                </TabsContent>
                <TabsContent value="ai">
                  <AIUsageSection />
                </TabsContent>
                <TabsContent value="integrations">
                  <IntegrationsSection />
                </TabsContent>
                <TabsContent value="advanced">
                  <AdvancedSection />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
