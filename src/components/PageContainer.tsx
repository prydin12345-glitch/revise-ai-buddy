import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function PageContainer({ children, maxWidth = "md" }: PageContainerProps) {
  const widthClasses = {
    sm: "max-w-2xl",
    md: "max-w-3xl",
    lg: "max-w-5xl",
    xl: "max-w-7xl"
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className={`${widthClasses[maxWidth]} mx-auto`}>
        {children}
      </div>
    </div>
  );
}