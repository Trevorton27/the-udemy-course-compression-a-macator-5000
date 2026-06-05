import { useEffect, useRef, useCallback } from 'react';

interface LogEvent {
  id: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
  timestamp: string;
}

interface Props {
  jobId: string;
  onDone: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  info: '#ccc',
  warn: '#ffa726',
  error: '#ef5350',
  success: '#66bb6a',
  debug: '#888',
};

export default function ExtractionLogPanel({ jobId, onDone }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const logsRef = useRef<LogEvent[]>([]);
  const renderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Append to DOM directly to avoid re-render per log line
  const appendToDOM = useCallback((events: LogEvent[]) => {
    const container = listRef.current;
    if (!container) return;
    for (const event of events) {
      const line = document.createElement('div');
      line.style.color = LEVEL_COLORS[event.level] ?? '#ccc';
      line.style.fontFamily = 'monospace';
      line.style.fontSize = '12px';
      line.style.padding = '1px 0';
      line.style.whiteSpace = 'pre-wrap';
      line.style.wordBreak = 'break-all';
      line.textContent = event.message;
      container.appendChild(line);
    }
    container.scrollTop = container.scrollHeight;
  }, []);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${jobId}/events`);

    const pendingBatch: LogEvent[] = [];

    es.onmessage = (e) => {
      const event = JSON.parse(e.data) as LogEvent;
      logsRef.current.push(event);
      pendingBatch.push(event);

      // Batch DOM updates to avoid thrashing during heavy log output
      if (!renderTimerRef.current) {
        renderTimerRef.current = setTimeout(() => {
          renderTimerRef.current = null;
          const toRender = pendingBatch.splice(0);
          appendToDOM(toRender);
        }, 50);
      }
    };

    es.addEventListener('done', () => {
      es.close();
      // Flush any remaining
      if (renderTimerRef.current) {
        clearTimeout(renderTimerRef.current);
        renderTimerRef.current = null;
      }
      appendToDOM(pendingBatch.splice(0));
      onDone();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
      if (renderTimerRef.current) clearTimeout(renderTimerRef.current);
    };
  }, [jobId, appendToDOM, onDone]);

  return (
    <div
      ref={listRef}
      style={{
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: 6,
        padding: 12,
        height: 400,
        overflowY: 'auto',
        marginTop: 8,
      }}
    />
  );
}
