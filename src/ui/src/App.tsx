import { useState, useCallback, useEffect } from 'react';
import CourseUrlForm from './components/CourseUrlForm';
import ProgressStatus from './components/ProgressStatus';
import ExtractionLogPanel from './components/ExtractionLogPanel';
import OutputFilesPanel from './components/OutputFilesPanel';
import CourseInventorySelector from './components/CourseInventorySelector';
import { submitScrapeJob, getJob } from './api';

type View = 'home' | 'job';

interface JobState {
  id: string;
  status: 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';
  outputFiles: string[];
  mode: string;
}

// Inventory shape returned from /api/files/download?path=.../course-inventory.json
interface CourseInventory {
  courseTitle: string;
  sections: Array<{ title: string; sectionIndex: number }>;
  technologies: string[];
}

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobState | null>(null);
  const [inventory, setInventory] = useState<CourseInventory | null>(null);
  const [transcriptsPath, setTranscriptsPath] = useState('');

  useEffect(() => {
    const root = document.documentElement;
    const vars = darkMode
      ? {
          '--bg': '#121212', '--surface': '#1e1e1e', '--text': '#e8e8e8',
          '--text-muted': '#999', '--border': '#555', '--accent': '#4d9ef7',
          '--accent-subtle': '#1a3360', '--error-bg': '#3b1a1a',
          '--error-border': '#8b3535', '--error-text': '#ff8a8a',
          '--section-border': '#333', '--input-bg': '#2a2a2a',
        }
      : {
          '--bg': '#fff', '--surface': '#fff', '--text': '#222',
          '--text-muted': '#666', '--border': '#ccc', '--accent': '#1a73e8',
          '--accent-subtle': '#e8f0fe', '--error-bg': '#ffebee',
          '--error-border': '#ef9a9a', '--error-text': '#c62828',
          '--section-border': '#e0e0e0', '--input-bg': '#fff',
        };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    document.body.style.background = darkMode ? '#121212' : '#fff';
    document.body.style.color = darkMode ? '#e8e8e8' : '#222';
  }, [darkMode]);

  async function handleStart(url: string, mode: string) {
    setLoading(true);
    setError('');
    try {
      const { jobId } = await submitScrapeJob(url, mode);
      setJob({ id: jobId, status: 'pending', outputFiles: [], mode });
      setView('job');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const handleDone = useCallback(async () => {
    if (!job) return;
    try {
      const snapshot = await getJob(job.id);
      setJob((prev) => prev ? { ...prev, status: snapshot.status, outputFiles: snapshot.outputFiles } : prev);

      // If this was an optimize-selected scrape, load the inventory for selection UI
      if (snapshot.params.mode === 'optimize-selected' && snapshot.status === 'complete') {
        const inventoryFile = snapshot.outputFiles.find((f) => f.endsWith('course-inventory.json'));
        if (inventoryFile) {
          const res = await fetch(`/api/files/download?path=${encodeURIComponent(inventoryFile)}`);
          if (res.ok) {
            const inv = await res.json() as CourseInventory;
            setInventory(inv);
            const tFile = snapshot.outputFiles.find((f) => f.endsWith('transcripts.json'));
            if (tFile) setTranscriptsPath(tFile);
          }
        }
      }
    } catch {
      // best effort
    }
  }, [job]);

  function handleLoginConfirmed() {
    setJob((prev) => prev ? { ...prev, status: 'running' } : prev);
  }

  function handleOptimizeJobStarted(jobId: string) {
    setInventory(null);
    setJob({ id: jobId, status: 'pending', outputFiles: [], mode: 'selected' });
  }

  return (
    <div style={{ maxWidth: 860, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif', color: 'var(--text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, marginBottom: 4, marginTop: 0 }}>The Udemy Course Compression-a-macator 5000</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Extract, scan, and optimize Udemy course transcripts.
          </p>
        </div>
        <button
          onClick={() => setDarkMode((d) => !d)}
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

      {error && (
        <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', borderRadius: 4, padding: '10px 14px', marginBottom: 20, color: 'var(--error-text)' }}>
          {error}
        </div>
      )}

      {view === 'home' && (
        <CourseUrlForm onSubmit={handleStart} loading={loading} />
      )}

      {view === 'job' && job && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <ProgressStatus
              status={job.status}
              jobId={job.id}
              onLoginConfirmed={handleLoginConfirmed}
            />
            <button
              onClick={() => { setView('home'); setJob(null); setInventory(null); }}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '4px 12px', cursor: 'pointer', color: 'var(--text)' }}
            >
              New job
            </button>
          </div>

          <h3 style={{ margin: '0 0 4px' }}>Live Log</h3>
          <ExtractionLogPanel jobId={job.id} onDone={handleDone} />

          <OutputFilesPanel files={job.outputFiles} />

          {inventory && transcriptsPath && (
            <div style={{ marginTop: 28, padding: 20, border: '1px solid var(--section-border)', borderRadius: 8 }}>
              <CourseInventorySelector
                transcriptsPath={transcriptsPath}
                inventory={inventory}
                onJobStarted={handleOptimizeJobStarted}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
