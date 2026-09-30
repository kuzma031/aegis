import type { ReactNode } from 'react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="ui-empty stack">
      <p className="heading">{title}</p>
      {description ? <p className="muted">{description}</p> : null}
      {action}
    </div>
  );
}
