import { useState } from 'react';
import ModeSelector from './ModeSelector';

const UDEMY_COURSE_RE = /^https?:\/\/(www\.)?udemy\.com\/course\/[^/]+/;

interface Props {
  onSubmit: (url: string, mode: string) => void;
  loading: boolean;
}

const MODE_DESCRIPTIONS = [
  {
    label: 'Extract transcripts only',
    description: 'Launches a browser, logs into Udemy, and scrapes all lecture transcripts. Outputs a course map, raw transcripts JSON, per-lecture markdown files, and a combined transcript.',
  },
  {
    label: 'Extract + scan (inventory)',
    description: 'Everything above, plus runs an inventory and classification pass over the content. Outputs an additional course-inventory.json and course-inventory.md summarising topics and sections.',
  },
  {
    label: 'Extract + optimize all',
    description: 'Everything in scan, then automatically generates a full optimized study plan for the entire course. Outputs an optimized-learning-plan.md.',
  },
  {
    label: 'Extract + select sections, then optimize',
    description: 'Runs extraction and scan, then pauses so you can pick which sections, technologies, or keywords you care about. A second pass then generates a targeted selected-learning-plan.md based on your selections.',
  },
  {
    label: 'Extract + build-first optimize',
    description: 'Everything in scan, then generates a build-first study plan that prioritizes all hands-on build lectures before watch lectures. Intro, outro, and bonus lectures are automatically moved to skip. Outputs a build-first-plan.md.',
  },
  {
    label: 'Extract + AI-powered optimization (Claude)',
    description: 'Everything in scan, then runs a two-pass Claude analysis: Haiku scores every lecture for watch value and concept coverage, Sonnet synthesizes a compressed learning path, identifies redundancy clusters, and generates portfolio deliverables. Outputs an ai-learning-plan.json. Requires ANTHROPIC_API_KEY.',
  },
];

function ModesModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', color: 'var(--text)', borderRadius: 8, padding: 28,
          maxWidth: 520, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}
      >
        <h2 style={{ margin: '0 0 18px', fontSize: 18 }}>What these modes do</h2>
        {MODE_DESCRIPTIONS.map((m) => (
          <div key={m.label} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{m.description}</div>
          </div>
        ))}
        <button
          onClick={onClose}
          style={{
            marginTop: 8, padding: '8px 20px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 14, cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function CourseUrlForm({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('optimize-all');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!UDEMY_COURSE_RE.test(url)) {
      setError('Please enter a valid Udemy course URL (https://www.udemy.com/course/<slug>/)');
      return;
    }
    setError('');
    onSubmit(url, mode);
  }

  return (
    <>
      {showModal && <ModesModal onClose={() => setShowModal(false)} />}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Udemy Course URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.udemy.com/course/your-course/"
            style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 4, border: '1px solid var(--border)', boxSizing: 'border-box', background: 'var(--input-bg)', color: 'var(--text)' }}
            disabled={loading}
            required
          />
          {error && <p style={{ color: 'red', margin: '4px 0 0', fontSize: 13 }}>{error}</p>}
        </div>

        <ModeSelector value={mode} onChange={setMode} />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 24px',
            background: loading ? '#aaa' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: 15,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Starting...' : 'Start'}
        </button>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            fontSize: 13,
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          What these modes do
        </button>
      </form>
    </>
  );
}
