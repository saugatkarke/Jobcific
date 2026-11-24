export function ExtensionPick({
  name,
  checked,
  onToggle,
}: {
  name: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="pricing-pick">
      <input
        type="checkbox"
        className="pricing-pick-input"
        checked={checked}
        onChange={onToggle}
      />
      <span className="pricing-pick-icon" aria-hidden="true">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path className="pricing-pick-plus" d="M8 4.5v7M4.5 8h7" />
          <path className="pricing-pick-tick" d="M4.75 8.25l2.25 2.25 4.25-4.75" pathLength={1} />
        </svg>
      </span>
      <span>{name}</span>
    </label>
  );
}
