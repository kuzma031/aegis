export function Clock({ value }: { value: string }) {
  return (
    <div className="ui-clock" aria-live="polite" aria-atomic="true">
      {value}
    </div>
  );
}
