import { Router, type Request, type Response } from 'express';
import { createJob, type JobParams } from '../jobs/jobStore.js';
import { startAiOptimizeJob } from '../jobs/jobRunner.js';

export const aiOptimizeRouter = Router();

aiOptimizeRouter.post('/', (req: Request, res: Response) => {
  const { transcriptsPath, focusPrompt } = req.body as {
    transcriptsPath?: string;
    focusPrompt?: string;
  };

  if (!transcriptsPath) {
    res.status(400).json({ error: 'transcriptsPath is required' });
    return;
  }

  const params: JobParams = {
    type: 'ai-optimize',
    transcriptsPath,
    focusPrompt: focusPrompt?.trim() || undefined,
  };
  const job = createJob(params);

  startAiOptimizeJob(job).catch((err) => {
    console.error('Unhandled AI optimize job error:', err);
  });

  res.json({ jobId: job.id });
});
