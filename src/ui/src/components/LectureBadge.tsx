interface Props {
  classification: 'build' | 'watch' | 'skim' | 'skip' | 'failed' | 'no-transcript';
  size?: 'sm' | 'md';
}

const COLORS: Record<string, { bg: string; color: string }> = {
  build: { bg: '#2e7d3222', color: '#2e7d32' },
  watch: { bg: '#1a73e822', color: '#1a73e8' },
  skim: { bg: '#e6510022', color: '#e65100' },
  skip: { bg: 'transparent', color: 'var(--text-muted)' },
  failed: { bg: 'var(--error-bg)', color: 'var(--error-text)' },
  'no-transcript': { bg: 'transparent', color: 'var(--border)' },
};

export default function LectureBadge({ classification, size = 'md' }: Props) {
  const { bg, color } = COLORS[classification] ?? COLORS['skip']!;
  const padding = size === 'sm' ? '2px 6px' : '3px 8px';
  const fontSize = size === 'sm' ? 11 : 12;

  return (
    <span
      style={{
        display: 'inline-block',
        padding,
        borderRadius: 10,
        fontSize,
        fontWeight: 500,
        background: bg,
        color,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {classification}
    </span>
  );
}
