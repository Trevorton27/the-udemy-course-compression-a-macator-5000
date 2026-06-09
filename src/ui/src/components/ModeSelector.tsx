interface Props {
  value: string;
  onChange: (mode: string) => void;
}

const MODES = [
  { value: 'scrape', label: 'Extract transcripts only' },
  { value: 'scan', label: 'Extract + scan (inventory)' },
  { value: 'optimize-all', label: 'Extract + optimize all' },
  { value: 'optimize-selected', label: 'Extract + select sections, then optimize' },
  { value: 'optimize-build-first', label: 'Extract + build-first optimize' },
  { value: 'optimize-ai', label: 'Extract + AI-powered optimization (Claude)' },
];

export default function ModeSelector({ value, onChange }: Props) {
  return (
    <fieldset style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '12px 16px' }}>
      <legend style={{ fontWeight: 600 }}>Mode</legend>
      {MODES.map((m) => (
        <label key={m.value} style={{ display: 'block', margin: '6px 0', cursor: 'pointer' }}>
          <input
            type="radio"
            name="mode"
            value={m.value}
            checked={value === m.value}
            onChange={() => onChange(m.value)}
            style={{ marginRight: 8 }}
          />
          {m.label}
        </label>
      ))}
    </fieldset>
  );
}
