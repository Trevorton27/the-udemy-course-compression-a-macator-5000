import { useState } from 'react';
import { submitAiOptimizeJob } from '../api';

interface Props {
  transcriptsPath: string;
  onJobStarted: (jobId: string) => void;
}

export default function AiOptimizePanel({ transcriptsPath, onJobStarted }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [focusPrompt, setFocusPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRun() {
    setLoading(true);
    setError('');
    try {
      const { jobId } = await submitAiOptimizeJob(transcriptsPath, focusPrompt || undefined);
      onJobStarted(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--accent)',
        borderRadius: 8,
        marginTop: 24,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          background: 'var(--accent-subtle)',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--accent)',
          fontWeight: 600,
          fontSize: 14,
          textAlign: 'left',
        }}
      >
        <span>AI-Powered Learning Path Analysis</span>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '18px 18px 20px', background: 'var(--surface)' }}>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Claude will analyze every lecture transcript in two passes — a per-lecture Haiku pass
            to score content, then a Sonnet synthesis pass to build a compressed learning path,
            identify redundancy, and generate portfolio deliverables. Results are cached until
            transcripts change.
          </p>

          <div style={{ marginBottom: 14 }}>
            <label
              style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 6 }}
            >
              Focus prompt <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={focusPrompt}
              onChange={(e) => setFocusPrompt(e.target.value)}
              placeholder="e.g. I already know Python basics. Focus on backend APIs and deployment."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--text)',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'system-ui, sans-serif',
              }}
            />
          </div>

          {error && (
            <p style={{ margin: '0 0 12px', color: 'var(--error-text)', fontSize: 13 }}>{error}</p>
          )}

          <button
            onClick={() => { void handleRun(); }}
            disabled={loading}
            style={{
              padding: '9px 22px',
              background: loading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Starting…' : 'Run AI Analysis'}
          </button>
        </div>
      )}
    </div>
  );
}
