import { useState, useEffect } from 'react';
import type { CourseLibraryEntry } from '../types';
import { getLibrary, deleteFromLibrary } from '../api';

interface Props {
  onOpenDashboard: (entry: CourseLibraryEntry) => void;
  onOpenCourseMap: (entry: CourseLibraryEntry) => void;
  onReoptimize: (entry: CourseLibraryEntry) => void;
}

const STATUS_COLORS: Record<string, string> = {
  complete: '#2e7d32',
  failed: 'var(--error-text)',
  partial: '#e65100',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CourseLibrary({ onOpenDashboard, onOpenCourseMap, onReoptimize }: Props) {
  const [entries, setEntries] = useState<CourseLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLibrary()
      .then((data) => setEntries(data.entries))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await deleteFromLibrary(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(String(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading library...</p>;

  if (error) {
    return (
      <div style={{ color: 'var(--error-text)', padding: 16 }}>
        Error loading library: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
        <div style={{ fontSize: 16 }}>No courses yet.</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Complete a scrape or optimize job to add courses here.</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '16px 20px',
            background: 'var(--surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{entry.courseTitle}</span>
                <span
                  style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11,
                    color: STATUS_COLORS[entry.status] ?? 'var(--text-muted)',
                    border: `1px solid ${STATUS_COLORS[entry.status] ?? 'var(--border)'}44`,
                    background: (STATUS_COLORS[entry.status] ?? '#888') + '11',
                  }}
                >
                  {entry.status}
                </span>
              </div>
              {entry.sourceUrl && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry.sourceUrl}
                </div>
              )}
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                {formatDate(entry.lastRunDate)}
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <span title="Transcripts extracted" style={{ color: 'var(--accent)' }}>
                  {entry.transcriptCount} transcripts
                </span>
                {entry.skippedCount > 0 && (
                  <span style={{ color: 'var(--text-muted)' }}>{entry.skippedCount} skipped</span>
                )}
                {entry.failedCount > 0 && (
                  <span style={{ color: 'var(--error-text)' }}>{entry.failedCount} failed</span>
                )}
                <span style={{ color: 'var(--text-muted)' }}>{entry.totalLectures} total</span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {entry.hasInventory && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                    inventory
                  </span>
                )}
                {entry.hasOptimizedPlan && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                    optimized plan
                  </span>
                )}
                {entry.hasSelectedPlan && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                    selected plan
                  </span>
                )}
                {entry.hasBuildFirstPlan && (
                  <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, background: '#2e7d3222', color: '#2e7d32' }}>
                    build-first plan
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Button group */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {entry.hasInventory && (
              <button
                onClick={() => onOpenDashboard(entry)}
                style={{
                  padding: '6px 14px', background: 'var(--accent)', color: '#fff',
                  border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                }}
              >
                Dashboard
              </button>
            )}
            {entry.hasInventory && (
              <button
                onClick={() => onOpenCourseMap(entry)}
                style={{
                  padding: '6px 14px', background: 'none', color: 'var(--accent)',
                  border: '1px solid var(--accent)', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                }}
              >
                Course Map
              </button>
            )}
            {entry.hasInventory && (
              <button
                onClick={() => onReoptimize(entry)}
                style={{
                  padding: '6px 14px', background: 'none', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                }}
              >
                Re-optimize
              </button>
            )}
            <button
              onClick={() => handleDelete(entry.id)}
              disabled={deletingId === entry.id}
              style={{
                padding: '6px 14px', background: 'none', color: 'var(--error-text)',
                border: '1px solid var(--error-border)', borderRadius: 4, fontSize: 13,
                cursor: deletingId === entry.id ? 'not-allowed' : 'pointer',
                marginLeft: 'auto',
              }}
            >
              {deletingId === entry.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
