import { useState, useCallback } from 'react';
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
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobState | null>(null);
  const [inventory, setInventory] = useState<CourseInventory | null>(null);
  const [transcriptsPath, setTranscriptsPath] = useState('');

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
    <div style={{ maxWidth: 860, margin: '40px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 24, marginBottom: 4 }}>Udemy Transcriptamacator 5000</h1>
      <p style={{ color: '#666', marginTop: 0, marginBottom: 32 }}>
        Extract, scan, and optimize Udemy course transcripts.
      </p>

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '10px 14px', marginBottom: 20, color: '#c62828' }}>
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
              style={{ background: 'none', border: '1px solid #ccc', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}
            >
              New job
            </button>
          </div>

          <h3 style={{ margin: '0 0 4px' }}>Live Log</h3>
          <ExtractionLogPanel jobId={job.id} onDone={handleDone} />

          <OutputFilesPanel files={job.outputFiles} />

          {inventory && transcriptsPath && (
            <div style={{ marginTop: 28, padding: 20, border: '1px solid #e0e0e0', borderRadius: 8 }}>
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
