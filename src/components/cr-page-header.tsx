import type { ReactNode } from "react";

interface CrPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export function CrPageHeader({ title, description, actions }: CrPageHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-mc-text-primary">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-mc-text-secondary">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
