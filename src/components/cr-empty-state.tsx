import { Inbox } from "lucide-react";

interface CrEmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function CrEmptyState({ icon, title, description, action }: CrEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mc-bg-surface text-mc-text-muted">
        {icon || <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-lg font-medium text-mc-text-secondary">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-mc-text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
