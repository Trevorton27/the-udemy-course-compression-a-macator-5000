import { useState } from 'react';
import ModeSelector from './ModeSelector';

const UDEMY_COURSE_RE = /^https?:\/\/(www\.)?udemy\.com\/course\/[^/]+/;

interface Props {
  onSubmit: (url: string, mode: string) => void;
  loading: boolean;
}

export default function CourseUrlForm({ onSubmit, loading }: Props) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState('optimize-all');
  const [error, setError] = useState('');

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
          style={{ width: '100%', padding: '8px 10px', fontSize: 14, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
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
          background: loading ? '#aaa' : '#1a73e8',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Starting...' : 'Start'}
      </button>
    </form>
  );
}
