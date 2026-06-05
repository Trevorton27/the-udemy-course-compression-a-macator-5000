import { useState } from 'react';
import type { CourseInventory } from '../types';
import LectureBadge from './LectureBadge';

interface Props {
  inventory: CourseInventory;
  transcriptStatus: Map<number, 'ok' | 'skipped' | 'error'>;
  onBack: () => void;
  onOpenSelector: () => void;
}

const STATUS_ICONS: Record<string, string> = {
  ok: '✓',
  skipped: '—',
  error: '✗',
};

const BADGE_FILTERS = ['build', 'watch', 'skim', 'skip'];

export default function CourseMapView({ inventory, transcriptStatus, onBack, onOpenSelector }: Props) {
  const [filterBadge, setFilterBadge] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');

  const textLower = filterText.toLowerCase();

  function lectureMatches(lec: CourseInventory['sections'][number]['lectures'][number]): boolean {
    if (filterBadge && lec.classification !== filterBadge) return false;
    if (textLower && !lec.title.toLowerCase().includes(textLower)) return false;
    return true;
  }

  const filteredSections = inventory.sections
    .map((section) => ({
      ...section,
      lectures: section.lectures.filter(lectureMatches),
    }))
    .filter((s) => s.lectures.length > 0);

  const totalFiltered = filteredSections.reduce((sum, s) => sum + s.lectures.length, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 12px',
            cursor: 'pointer',
            color: 'var(--text)',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20 }}>{inventory.courseTitle}</h2>
        <button
          onClick={onOpenSelector}
          style={{
            marginLeft: 'auto',
            padding: '6px 14px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Customize Selection
        </button>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Search lectures..."
          style={{
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            fontSize: 13,
            background: 'var(--input-bg)',
            color: 'var(--text)',
            width: 200,
          }}
        />
        {BADGE_FILTERS.map((badge) => (
          <button
            key={badge}
            onClick={() => setFilterBadge(filterBadge === badge ? null : badge)}
            style={{
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 12,
              cursor: 'pointer',
              border: `1px solid ${filterBadge === badge ? 'var(--accent)' : 'var(--border)'}`,
              background: filterBadge === badge ? 'var(--accent-subtle)' : 'transparent',
              color: filterBadge === badge ? 'var(--accent)' : 'var(--text)',
            }}
          >
            {badge}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>
          {totalFiltered} lectures
        </span>
      </div>

      {/* Sections */}
      {filteredSections.map((section) => (
        <div key={section.sectionIndex} style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 0',
              borderBottom: '1px solid var(--section-border)',
              marginBottom: 8,
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 15 }}>{section.title}</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 11,
                background: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              {section.lectures.length}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr 32px 100px',
              gap: 0,
            }}
          >
            {/* Header */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px' }}>#</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px' }}>Title</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px' }}>✓</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px' }}>Type</div>

            {section.lectures.map((lec) => {
              const status = transcriptStatus.get(lec.lectureIndex);
              const statusIcon = status ? STATUS_ICONS[status] ?? '' : '';
              const statusColor = status === 'error' ? 'var(--error-text)' : status === 'ok' ? '#2e7d32' : 'var(--text-muted)';

              return (
                <>
                  <div
                    key={`${lec.lectureIndex}-idx`}
                    style={{ padding: '5px 6px', fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}
                  >
                    {String(lec.lectureIndex).padStart(3, '0')}
                  </div>
                  <div
                    key={`${lec.lectureIndex}-title`}
                    style={{ padding: '5px 6px', fontSize: 13, color: 'var(--text)' }}
                  >
                    {lec.title}
                  </div>
                  <div
                    key={`${lec.lectureIndex}-status`}
                    style={{ padding: '5px 6px', fontSize: 13, color: statusColor, textAlign: 'center' }}
                  >
                    {statusIcon}
                  </div>
                  <div
                    key={`${lec.lectureIndex}-badge`}
                    style={{ padding: '4px 6px' }}
                  >
                    <LectureBadge classification={lec.classification} size="sm" />
                  </div>
                </>
              );
            })}
          </div>
        </div>
      ))}

      {filteredSections.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          No lectures match your filters.
        </p>
      )}
    </div>
  );
}
