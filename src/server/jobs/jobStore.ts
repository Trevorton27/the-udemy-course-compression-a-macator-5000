import { randomUUID } from 'crypto';
import type { ServerResponse } from 'http';
import type { LogEvent } from '../../utils/logger.js';
import type { FailedLecture } from '../../types/optimizerTypes.js';

export type JobStatus = 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';

export interface ScrapeJobParams {
  type: 'scrape';
  url: string;
  mode: string;
}

export interface OptimizeJobParams {
  type: 'optimize';
  transcriptsPath: string;
  mode: string;
  criteria?: {
    sections?: string[];
    technologies?: string[];
    keyword?: string;
    lectures?: string[];
  };
}

export interface RetryJobParams {
  type: 'retry';
  transcriptsPath: string;
  lectures: FailedLecture[];
}

export interface AiOptimizeJobParams {
  type: 'ai-optimize';
  transcriptsPath: string;
  focusPrompt?: string;
}

export type JobParams = ScrapeJobParams | OptimizeJobParams | RetryJobParams | AiOptimizeJobParams;

export interface Job {
  id: string;
  status: JobStatus;
  params: JobParams;
  logs: LogEvent[];
  outputFiles: string[];
  loginResolver?: () => void;
  sseClients: Set<ServerResponse>;
  createdAt: string;
}

const jobs = new Map<string, Job>();

export function createJob(params: JobParams): Job {
  const job: Job = {
    id: randomUUID(),
    status: 'pending',
    params,
    logs: [],
    outputFiles: [],
    sseClients: new Set(),
    createdAt: new Date().toISOString(),
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function appendLog(job: Job, event: LogEvent): void {
  job.logs.push(event);
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of job.sseClients) {
    try {
      client.write(data);
    } catch {
      job.sseClients.delete(client);
    }
  }
}

export function addSseClient(job: Job, res: ServerResponse): void {
  job.sseClients.add(res);
}

export function removeSseClient(job: Job, res: ServerResponse): void {
  job.sseClients.delete(res);
}

export function sendSseDone(job: Job): void {
  const data = `event: done\ndata: ${JSON.stringify({ status: job.status })}\n\n`;
  for (const client of job.sseClients) {
    try {
      client.write(data);
      client.end();
    } catch {
      // ignore
    }
  }
  job.sseClients.clear();
}
