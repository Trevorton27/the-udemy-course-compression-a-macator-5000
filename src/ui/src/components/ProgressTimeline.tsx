const STAGES = [
  { key: 'waiting', label: 'Waiting' },
  { key: 'discovering', label: 'Discovering' },
  { key: 'extracting', label: 'Extracting' },
  { key: 'building-inventory', label: 'Inventory' },
  { key: 'analyzing', label: 'Analyzing' },
  { key: 'synthesizing', label: 'Synthesizing' },
  { key: 'generating-plan', label: 'Plan' },
  { key: 'complete', label: 'Complete' },
];

interface Props {
  stage: string;
  currentLecture: string | undefined;
  processed: number;
  total: number;
  visitedStages?: Set<string>;
}

export default function ProgressTimeline({ stage, currentLecture, processed, total, visitedStages }: Props) {
  const isFailed = stage === 'failed';
  const visited = visitedStages ?? new Set([stage]);

  // Only show stages that are relevant to this job (visited or active or complete)
  const activeStages = STAGES.filter(
    (s) => visited.has(s.key) || s.key === stage || s.key === 'complete',
  );

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {activeStages.map((s) => {
          const isActive = s.key === stage;
          const isComplete = visited.has(s.key) && !isActive && !isFailed;
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

      {(stage === 'extracting' || stage === 'analyzing') && total > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
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

      {stage === 'synthesizing' && (
        <div style={{ marginTop: 6 }}>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: '100%',
                background: `linear-gradient(90deg, var(--accent) 0%, var(--accent-subtle) 50%, var(--accent) 100%)`,
                backgroundSize: '200% 100%',
                borderRadius: 3,
                animation: 'shimmer 1.5s infinite linear',
              }}
            />
          </div>
          <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Claude is synthesizing your learning path…
          </p>
        </div>
      )}
    </div>
  );
}
