import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SettingsCardProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  destructive?: boolean;
  className?: string;
}

export const SettingsCard = ({
  icon: Icon,
  title,
  description,
  children,
  destructive = false,
  className,
}: SettingsCardProps) => {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-card overflow-hidden transition-shadow hover:shadow-md',
        destructive ? 'border-destructive/30' : 'border-border/60',
        className,
      )}
    >
      <div className="px-5 py-4 border-b border-border/40 flex items-center gap-3">
        {Icon && (
          <div
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
              destructive ? 'bg-destructive/10' : 'bg-primary/10',
            )}
          >
            <Icon
              className={cn('w-4 h-4', destructive ? 'text-destructive' : 'text-primary')}
            />
          </div>
        )}
        <div className="min-w-0">
          <h3
            className={cn(
              'text-[15px] font-semibold leading-tight',
              destructive ? 'text-destructive' : 'text-foreground',
            )}
          >
            {title}
          </h3>
          {description && (
            <p className="text-[12.5px] text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
};
