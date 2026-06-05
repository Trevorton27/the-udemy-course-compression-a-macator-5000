import { confirmLogin } from '../api';

type Status = 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';

interface Props {
  status: Status;
  jobId: string;
  onLoginConfirmed: () => void;
}

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Pending...',
  running: 'Running',
  'waiting-for-login': 'Waiting for Udemy login',
  complete: 'Complete',
  failed: 'Failed',
};

const STATUS_COLORS: Record<Status, string> = {
  pending: '#888',
  running: '#1a73e8',
  'waiting-for-login': '#f57c00',
  complete: '#2e7d32',
  failed: '#c62828',
};

export default function ProgressStatus({ status, jobId, onLoginConfirmed }: Props) {
  async function handleLoginConfirmed() {
    try {
      await confirmLogin(jobId);
      onLoginConfirmed();
    } catch (err) {
      console.error('Login confirmation failed:', err);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: STATUS_COLORS[status],
        }}
      />
      <span style={{ color: STATUS_COLORS[status], fontWeight: 600 }}>
        {STATUS_LABELS[status]}
      </span>

      {status === 'waiting-for-login' && (
        <button
          onClick={handleLoginConfirmed}
          style={{
            marginLeft: 16,
            padding: '6px 18px',
            background: '#f57c00',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          I've logged in
        </button>
      )}
    </div>
  );
}
