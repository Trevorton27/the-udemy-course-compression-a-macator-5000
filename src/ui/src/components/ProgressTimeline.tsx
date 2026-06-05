const STAGES = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'discovering', label: 'Discovering' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'building-inventory', label: 'Inventory' },
  { key: 'generating-plan', label: 'Plan' },
  { key: 'complete', label: 'Complete' },
];

interface Props {
  stage: string;
  currentLecture: string | undefined;
  processed: number;
  total: number;
}

export default function ProgressTimeline({ stage, currentLecture, processed, total }: Props) {
  const activeIdx = STAGES.findIndex((s) => s.key === stage);
  const isFailed = stage === 'failed';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => {
          const isActive = s.key === stage;
          const isComplete = activeIdx > i && !isFailed;
          let bg = 'var(--border)';
          let color = 'var(--text-muted)';
          if (isFailed && isActive) {
            bg = 'var(--error-bg)';
            color = 'var(--error-text)';
          } else if (isActive) {
            bg = 'var(--accent)';
            color = '#fff';
          } else if (isComplete) {
            bg = 'var(--accent-subtle)';
            color = 'var(--accent)';
          }

          return (
            <span
              key={s.key}
              style={{
                padding: '3px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                background: bg,
                color,
                border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
              }}
            >
              {s.label}
            </span>
          );
        })}
        {isFailed && (
          <span
            style={{
              padding: '3px 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              background: 'var(--error-bg)',
              color: 'var(--error-text)',
              border: '1px solid var(--error-border)',
            }}
          >
            Failed
          </span>
        )}
      </div>

      {stage === 'extracting' && total > 0 && (
        <div style={{ marginTop: 6 }}>
          <div
            style={{
              height: 6,
              background: 'var(--border)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min((processed / total) * 100, 100)}%`,
                background: 'var(--accent)',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {processed} / {total}
            </span>
            {currentLecture && (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  maxWidth: '70%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {currentLecture}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
