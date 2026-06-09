import type { DashboardData } from '../types';

interface Props {
  data: DashboardData;
  outputFiles: string[];
  onOpenCourseMap: () => void;
  onOpenStudyPlan: () => void;
  onOpenSelector: () => void;
  onRetryErrors: () => void;
  onOpenAiPlan?: () => void;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  build: '#2e7d32',
  watch: '#1a73e8',
  skim: '#e65100',
  skip: '#999',
};

export default function CourseDashboard({
  data,
  outputFiles,
  onOpenCourseMap,
  onOpenStudyPlan,
  onOpenSelector,
  onRetryErrors,
  onOpenAiPlan,
}: Props) {
  const hasPlan = data.availablePlanPaths.length > 0;
  const hasInventory = outputFiles.some((f) => f.endsWith('course-inventory.json'));

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>{data.courseTitle}</h2>
      <p style={{ margin: '0 0 24px', color: 'var(--text-muted)', fontSize: 13 }}>
        Course analysis complete
      </p>

      {/* Stat grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Transcripts', value: data.transcriptCount, color: 'var(--accent)' },
          { label: 'Skipped', value: data.skippedCount, color: 'var(--text-muted)' },
          { label: 'Failed', value: data.failedCount, color: data.failedCount > 0 ? 'var(--error-text)' : 'var(--text-muted)' },
          { label: 'Sections', value: data.totalSections, color: 'var(--text)' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '14px 16px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 700, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Classification counts */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Classification
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.entries(data.classificationCounts) as [string, number][]).map(([cls, count]) => (
            <span
              key={cls}
              style={{
                padding: '4px 12px',
                borderRadius: 12,
                fontSize: 13,
                background: CLASSIFICATION_COLORS[cls] + '22',
                color: CLASSIFICATION_COLORS[cls],
                border: `1px solid ${CLASSIFICATION_COLORS[cls]}44`,
                fontWeight: 500,
              }}
            >
              {count} {cls}
            </span>
          ))}
        </div>
      </div>

      {/* Technologies */}
      {data.technologies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Technologies
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.technologies.map((tech) => (
              <span
                key={tech}
                style={{
                  padding: '3px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  fontFamily: 'monospace',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error recovery */}
      {data.hasErrors && (
        <div
          style={{
            padding: '12px 16px',
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 8,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--error-text)', fontSize: 14 }}>
            {data.errorCount} lecture{data.errorCount !== 1 ? 's' : ''} failed to extract
          </span>
          <button
            onClick={onRetryErrors}
            style={{
              padding: '6px 14px',
              background: 'var(--error-text)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Retry Failed
          </button>
        </div>
      )}

      {/* CTA buttons */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {hasInventory && (
          <button
            onClick={onOpenCourseMap}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            View Course Map
          </button>
        )}
        {hasPlan && (
          <button
            onClick={onOpenStudyPlan}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            View Study Plan
          </button>
        )}
        {hasInventory && (
          <button
            onClick={onOpenSelector}
            style={{
              padding: '10px 20px',
              background: 'none',
              color: 'var(--accent)',
              border: '1px solid var(--accent)',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Customize Selection
          </button>
        )}
        {data.hasAiPlan && onOpenAiPlan && (
          <button
            onClick={onOpenAiPlan}
            style={{
              padding: '10px 20px',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            View AI Plan
          </button>
        )}
      </div>
    </div>
  );
}
