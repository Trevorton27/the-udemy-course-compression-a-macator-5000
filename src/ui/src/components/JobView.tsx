import ProgressStatus from './ProgressStatus';
import ProgressTimeline from './ProgressTimeline';
import ExtractionLogPanel from './ExtractionLogPanel';
import OutputFilesPanel from './OutputFilesPanel';
import type { JobProgress } from '../hooks/useJobProgress';

interface JobState {
  id: string;
  status: 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';
  outputFiles: string[];
  mode: string;
}

interface Props {
  job: JobState;
  progress: JobProgress;
  onDone: () => void;
  onLoginConfirmed: () => void;
  onNewJob: () => void;
}

export default function JobView({ job, progress, onDone, onLoginConfirmed, onNewJob }: Props) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <ProgressStatus
          status={job.status}
          jobId={job.id}
          onLoginConfirmed={onLoginConfirmed}
        />
        <button
          onClick={onNewJob}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '4px 12px',
            cursor: 'pointer',
            color: 'var(--text)',
          }}
        >
          New job
        </button>
      </div>

      <ProgressTimeline
        stage={progress.stage}
        currentLecture={progress.currentLecture}
        processed={progress.processed}
        total={progress.total}
        visitedStages={progress.visitedStages}
      />

      <h3 style={{ margin: '0 0 4px' }}>Live Log</h3>
      <ExtractionLogPanel jobId={job.id} onDone={onDone} />

      <OutputFilesPanel files={job.outputFiles} />
    </div>
  );
}
