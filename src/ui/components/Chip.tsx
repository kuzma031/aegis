import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children: ReactNode;
}

export function Chip({ selected = false, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} className="ui-chip" aria-pressed={selected} {...rest}>
      {children}
    </button>
  );
}
