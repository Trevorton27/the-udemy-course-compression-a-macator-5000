import { useState, useEffect } from 'react';

export interface JobProgress {
  stage: string;
  currentLecture: string | undefined;
  processed: number;
  total: number;
  done: boolean;
}

export function useJobProgress(jobId: string | null): JobProgress {
  const [progress, setProgress] = useState<JobProgress>({
    stage: 'waiting',
    currentLecture: undefined,
    processed: 0,
    total: 0,
    done: false,
  });

  useEffect(() => {
    if (!jobId) return;

    const es = new EventSource(`/api/jobs/${jobId}/events`);

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as {
        meta?: {
          stage?: string;
          currentLecture?: string;
          processed?: number;
          total?: number;
        };
      };
      if (event.meta?.stage) {
        setProgress((prev) => ({
          ...prev,
          stage: event.meta!.stage!,
          currentLecture: event.meta!.currentLecture ?? prev.currentLecture,
          processed: event.meta!.processed ?? prev.processed,
          total: event.meta!.total ?? prev.total,
        }));
      }
    };

    es.addEventListener('done', () => {
      es.close();
      setProgress((prev) => ({ ...prev, done: true }));
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [jobId]);

  return progress;
}
