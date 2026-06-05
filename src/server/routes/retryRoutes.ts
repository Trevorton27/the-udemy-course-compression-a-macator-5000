import { Router, type Request, type Response } from 'express';
import { createJob, type JobParams } from '../jobs/jobStore.js';
import { startRetryJob } from '../jobs/jobRunner.js';
import type { FailedLecture } from '../../types/optimizerTypes.js';

export const retryRouter = Router();

retryRouter.post('/', (req: Request, res: Response) => {
  const { transcriptsPath, lectures } = req.body as {
    transcriptsPath?: string;
    lectures?: FailedLecture[];
  };

  if (!transcriptsPath || !lectures || !Array.isArray(lectures)) {
    res.status(400).json({ error: 'transcriptsPath and lectures array are required' });
    return;
  }

  const params: JobParams = { type: 'retry', transcriptsPath, lectures };
  const job = createJob(params);

  startRetryJob(job).catch((err) => {
    console.error('Unhandled retry job error:', err);
  });

  res.json({ jobId: job.id });
});
