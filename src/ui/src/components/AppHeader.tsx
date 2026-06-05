interface Props {
  darkMode: boolean;
  onToggleDark: () => void;
  onGoLibrary: () => void;
  onGoHome?: () => void;
}

export default function AppHeader({ darkMode, onToggleDark, onGoLibrary, onGoHome }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 32,
      }}
    >
      <div>
        <h1
          onClick={onGoHome}
          style={{
            fontSize: 24,
            marginBottom: 4,
            marginTop: 0,
            cursor: onGoHome ? 'pointer' : 'default',
          }}
        >
          The Udemy Course Compression-a-macator 5000
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Extract, scan, and optimize Udemy course transcripts.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={onGoLibrary}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
          }}
        >
          Library
        </button>
        <button
          onClick={onToggleDark}
          title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--text)',
            whiteSpace: 'nowrap',
          }}
        >
          {darkMode ? '☀ Light' : '☾ Dark'}
        </button>
      </div>
    </div>
  );
}
