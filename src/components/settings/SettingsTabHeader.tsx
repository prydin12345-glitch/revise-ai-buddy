import { LucideIcon } from 'lucide-react';

interface SettingsTabHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const SettingsTabHeader = ({ icon: Icon, title, description }: SettingsTabHeaderProps) => {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-foreground leading-tight">{title}</h2>
        <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
};
