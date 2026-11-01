import type { InputHTMLAttributes, ReactNode } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode;
}

export function Toggle({ label, className = '', disabled, ...rest }: ToggleProps) {
  return (
    <label className={`ui-toggle${disabled ? ' is-disabled' : ''} ${className}`.trim()}>
      <input className="ui-toggle-input" type="checkbox" disabled={disabled} {...rest} />
      <span className="ui-toggle-track" aria-hidden="true" />
      <span className="ui-toggle-label">{label}</span>
    </label>
  );
}