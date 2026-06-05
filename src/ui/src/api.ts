export interface JobSnapshot {
  id: string;
  status: 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';
  params: { type: string; url?: string; transcriptsPath?: string; mode: string };
  logCount: number;
  outputFiles: string[];
  createdAt: string;
}

export async function submitScrapeJob(url: string, mode: string): Promise<{ jobId: string }> {
  const res = await fetch('/api/jobs/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitOptimizeJob(
  transcriptsPath: string,
  mode: string,
  criteria?: { sections?: string[]; technologies?: string[]; keyword?: string },
): Promise<{ jobId: string }> {
  const res = await fetch('/api/jobs/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcriptsPath, mode, criteria }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmLogin(jobId: string): Promise<void> {
  const res = await fetch(`/api/jobs/${jobId}/login-confirmed`, { method: 'POST' });
  if (!res.ok) throw new Error(await res.text());
}

export async function getJob(jobId: string): Promise<JobSnapshot> {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getJobFiles(jobId: string): Promise<{ files: string[] }> {
  const res = await fetch(`/api/jobs/${jobId}/files`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
