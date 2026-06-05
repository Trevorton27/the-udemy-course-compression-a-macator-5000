import { Router, type Request, type Response } from 'express';
import { createJob, getJob, addSseClient, removeSseClient, type JobParams } from '../jobs/jobStore.js';
import { startScrapeJob, startOptimizeJob, toRelativePath } from '../jobs/jobRunner.js';

export const jobRouter = Router();

jobRouter.post('/scrape', (req: Request, res: Response) => {
  const { url, mode } = req.body as { url: string; mode: string };
  if (!url || !mode) {
    res.status(400).json({ error: 'url and mode are required' });
    return;
  }

  const params: JobParams = { type: 'scrape', url, mode };
  const job = createJob(params);

  // Fire and forget — client tracks via SSE
  startScrapeJob(job).catch((err) => {
    console.error('Unhandled scrape job error:', err);
  });

  res.json({ jobId: job.id });
});

jobRouter.post('/optimize', (req: Request, res: Response) => {
  const { transcriptsPath, mode, criteria } = req.body as {
    transcriptsPath: string;
    mode: string;
    criteria?: { sections?: string[]; technologies?: string[]; keyword?: string };
  };

  if (!transcriptsPath || !mode) {
    res.status(400).json({ error: 'transcriptsPath and mode are required' });
    return;
  }

  const params: JobParams = { type: 'optimize', transcriptsPath, mode, criteria };
  const job = createJob(params);

  startOptimizeJob(job).catch((err) => {
    console.error('Unhandled optimize job error:', err);
  });

  res.json({ jobId: job.id });
});

jobRouter.get('/:jobId', (req: Request, res: Response) => {
  const job = getJob(String(req.params['jobId'] ?? ''));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    id: job.id,
    status: job.status,
    params: job.params,
    logCount: job.logs.length,
    outputFiles: job.outputFiles.map(toRelativePath),
    createdAt: job.createdAt,
  });
});

jobRouter.get('/:jobId/events', (req: Request, res: Response) => {
  const job = getJob(String(req.params['jobId'] ?? ''));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Replay buffered logs
  for (const event of job.logs) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // If job already finished, send done immediately
  if (job.status === 'complete' || job.status === 'failed') {
    res.write(`event: done\ndata: ${JSON.stringify({ status: job.status })}\n\n`);
    res.end();
    return;
  }

  addSseClient(job, res);

  req.on('close', () => {
    removeSseClient(job, res);
  });
});

jobRouter.post('/:jobId/login-confirmed', (req: Request, res: Response) => {
  const job = getJob(String(req.params['jobId'] ?? ''));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  if (job.status !== 'waiting-for-login' || !job.loginResolver) {
    res.status(400).json({ error: 'Job is not waiting for login' });
    return;
  }

  job.loginResolver();
  job.loginResolver = undefined;
  res.json({ ok: true });
});

jobRouter.get('/:jobId/files', (req: Request, res: Response) => {
  const job = getJob(String(req.params['jobId'] ?? ''));
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({ files: job.outputFiles.map(toRelativePath) });
});
