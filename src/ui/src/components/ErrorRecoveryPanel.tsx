import { useState, useEffect } from 'react';
import type { FailedLecture, LectureResult } from '../types';
import { retryLectures } from '../api';

interface Props {
  errorFilePath: string;
  transcriptsPath: string;
  onRetryStarted: (jobId: string) => void;
}

export default function ErrorRecoveryPanel({ errorFilePath, transcriptsPath, onRetryStarted }: Props) {
  const [failedLectures, setFailedLectures] = useState<FailedLecture[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/files/download?path=${encodeURIComponent(errorFilePath)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.statusText)))
      .then((results: LectureResult[]) => {
        const failed: FailedLecture[] = results
          .filter((r) => !!r.error)
          .map((r) => ({
            lectureIndex: r.lecture.index,
            title: r.lecture.title,
            url: r.lecture.url,
            sectionTitle: r.lecture.sectionTitle,
            sectionIndex: r.lecture.sectionIndex,
            error: r.error ?? '',
          }));
        setFailedLectures(failed);
      })
      .catch(() => setFailedLectures([]))
      .finally(() => setLoading(false));
  }, [errorFilePath]);

  function toggleDismiss(idx: number) {
    setDismissed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  async function handleRetry(lectures: FailedLecture[]) {
    setLoading(true);
    try {
      const { jobId } = await retryLectures(transcriptsPath, lectures);
      onRetryStarted(jobId);
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setLoading(false);
    }
  }

  const remaining = failedLectures.filter((l) => !dismissed.has(l.lectureIndex));

  if (!loading && failedLectures.length === 0) return null;

  return (
    <div
      style={{
        marginTop: 24,
        border: '1px solid var(--error-border)',
        borderRadius: 8,
        background: 'var(--error-bg)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer',
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ fontWeight: 600, color: 'var(--error-text)', fontSize: 14 }}>
          {loading ? 'Loading errors...' : `${failedLectures.length} lecture${failedLectures.length !== 1 ? 's' : ''} failed`}
        </span>
        <span style={{ color: 'var(--error-text)', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </div>

      {open && !loading && (
        <div style={{ borderTop: '1px solid var(--error-border)', padding: '8px 0' }}>
          {failedLectures.map((lec) => (
            <div
              key={lec.lectureIndex}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 16px',
                opacity: dismissed.has(lec.lectureIndex) ? 0.4 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                  [{String(lec.lectureIndex).padStart(3, '0')}] {lec.title}
                </div>
                <div
                  style={{
                    fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                  }}
                  title={lec.error}
                >
                  {lec.sectionTitle} — {lec.error.slice(0, 80)}{lec.error.length > 80 ? '...' : ''}
                </div>
              </div>
              <button
                onClick={() => toggleDismiss(lec.lectureIndex)}
                style={{
                  background: 'none', border: '1px solid var(--error-border)',
                  borderRadius: 4, padding: '3px 10px', fontSize: 12,
                  cursor: 'pointer', color: 'var(--error-text)', whiteSpace: 'nowrap',
                }}
              >
                {dismissed.has(lec.lectureIndex) ? 'Un-skip' : 'Skip'}
              </button>
            </div>
          ))}

          <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleRetry(remaining)}
              disabled={loading || remaining.length === 0}
              style={{
                padding: '8px 18px', background: 'var(--error-text)', color: '#fff',
                border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                opacity: remaining.length === 0 ? 0.5 : 1,
              }}
            >
              {dismissed.size > 0 ? `Retry Selected (${remaining.length})` : `Retry All Failed (${remaining.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
