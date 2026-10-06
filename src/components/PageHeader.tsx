import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { hasAppHistory } from "@/lib/workspace-navigation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backTo?: string;
  step?: string;
}

export function PageHeader({ title, subtitle, showBack = true, backTo, step }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (hasAppHistory()) navigate(-1);
    else navigate(backTo || '/dashboard');
  };

  return (
    <div className="mb-8 max-w-3xl">
      {showBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      )}
      {step && (
        <p className="text-sm text-muted-foreground mb-2">{step}</p>
      )}
      <h1 className="text-2xl sm:text-3xl font-bold leading-tight text-foreground">{title}</h1>
      {subtitle && (
        <p className="text-sm sm:text-base leading-relaxed text-muted-foreground mt-2">{subtitle}</p>
      )}
    </div>
  );
}
