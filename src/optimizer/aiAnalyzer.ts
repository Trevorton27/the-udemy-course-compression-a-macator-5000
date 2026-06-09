import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { getAiClient, HAIKU_MODEL, SONNET_MODEL } from './aiClient.js';
import { writeFile } from '../storage.js';
import type { LectureResult } from '../types.js';
import type {
  LectureAnalysis,
  AiCourseSynthesis,
  AiLearningPlan,
  LearningPhase,
} from '../types/aiTypes.js';
import type { AppLogger } from '../utils/logger.js';
import { consoleLogger } from '../utils/logger.js';

const BATCH_SIZE = parseInt(process.env['AI_BATCH_SIZE'] ?? '10', 10);
const BATCH_DELAY_MS = parseInt(process.env['AI_BATCH_DELAY_MS'] ?? '500', 10);

// ─── Cost estimation ─────────────────────────────────────────────────────────

export function estimateAnalysisCost(results: LectureResult[]): {
  formatted: string;
  lectureCount: number;
} {
  const valid = results.filter((r) => !r.skipped && !r.error && r.rows.length > 0).length;
  const avgTokens = 900;
  const pass1Input = valid * (avgTokens + 200);
  const pass1Output = valid * 120;
  // Haiku 4.5 pricing: $0.80/MTok in, $4/MTok out
  const pass1Cost = (pass1Input / 1_000_000) * 0.8 + (pass1Output / 1_000_000) * 4.0;
  // Sonnet 4.6: $3/MTok in, $15/MTok out
  const pass2Input = valid * 160 + 600;
  const pass2Output = 3000;
  const pass2Cost = (pass2Input / 1_000_000) * 3.0 + (pass2Output / 1_000_000) * 15.0;
  const total = pass1Cost + pass2Cost;
  return {
    formatted: total < 0.01 ? '<$0.01' : `~$${total.toFixed(2)}`,
    lectureCount: valid,
  };
}

// ─── Caching ─────────────────────────────────────────────────────────────────

function hashFile(filePath: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

function isCacheValid(transcriptsPath: string, outputDir: string): boolean {
  const planPath = path.join(outputDir, 'ai-learning-plan.json');
  if (!fs.existsSync(planPath)) return false;
  try {
    const plan = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as { transcriptsHash?: string };
    if (!plan.transcriptsHash) return false;
    return plan.transcriptsHash === hashFile(transcriptsPath);
  } catch {
    return false;
  }
}

// ─── Pass 1: per-lecture analysis (Haiku) ────────────────────────────────────

const PASS1_SYSTEM =
  'You are a course content analyzer. Return ONLY valid JSON with no markdown fences or extra text.';

const PASS1_SCHEMA = `{
  "concepts": string[],      // key concepts taught — max 5, be specific
  "codeTopics": string[],    // specific APIs/patterns/tools shown in code — max 5
  "watchValue": number,      // 1=skip entirely 2=summary only 3=watch at 2x 4=watch carefully 5=code-along
  "canBeReplaced": string|null, // null if unique content; otherwise what replaces it (e.g. "official docs", "lecture 31")
  "summary": string          // 2-3 sentences: what does this lecture actually teach?
}`;

async function analyzeLecture(result: LectureResult): Promise<LectureAnalysis> {
  const client = getAiClient();
  const transcript = result.rows
    .map((r) => r.text)
    .join(' ')
    .slice(0, 7000);

  const response = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 512,
    system: PASS1_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Analyze this lecture and return JSON matching this schema exactly:\n${PASS1_SCHEMA}\n\nLecture title: ${result.lecture.title}\nSection: ${result.lecture.sectionTitle}\n\nTranscript:\n${transcript}`,
      },
    ],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}';
  // Strip any accidental markdown fences
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const parsed = JSON.parse(jsonStr) as Partial<LectureAnalysis>;

  const watchRaw = parsed.watchValue;
  const watchValue: LectureAnalysis['watchValue'] =
    typeof watchRaw === 'number' && watchRaw >= 1 && watchRaw <= 5
      ? (Math.round(watchRaw) as LectureAnalysis['watchValue'])
      : 3;

  return {
    lectureIndex: result.lecture.index,
    title: result.lecture.title,
    concepts: Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 5) : [],
    codeTopics: Array.isArray(parsed.codeTopics) ? parsed.codeTopics.slice(0, 5) : [],
    watchValue,
    canBeReplaced:
      typeof parsed.canBeReplaced === 'string' && parsed.canBeReplaced.length > 0
        ? parsed.canBeReplaced
        : null,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}

function stubAnalysis(result: LectureResult): LectureAnalysis {
  return {
    lectureIndex: result.lecture.index,
    title: result.lecture.title,
    concepts: [],
    codeTopics: [],
    watchValue: 1,
    canBeReplaced: result.skipped ? `Skipped: ${result.skipReason ?? 'no transcript'}` : null,
    summary: result.error
      ? `Error during extraction: ${result.error}`
      : result.skipped
        ? `Skipped — no transcript available.`
        : 'No content.',
  };
}

async function runPass1(
  results: LectureResult[],
  logger: AppLogger,
): Promise<LectureAnalysis[]> {
  const valid = results.filter((r) => !r.skipped && !r.error && r.rows.length > 0);
  const total = valid.length;
  const analysisByIndex = new Map<number, LectureAnalysis>();

  // Stubs for lectures with no transcript
  for (const r of results) {
    if (r.skipped || r.error || r.rows.length === 0) {
      analysisByIndex.set(r.lecture.index, stubAnalysis(r));
    }
  }

  let processed = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = valid.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (r) => {
        try {
          return await analyzeLecture(r);
        } catch (err) {
          logger.warn(`  Pass 1 fallback for lecture ${r.lecture.index}: ${String(err)}`);
          return stubAnalysis(r);
        }
      }),
    );
    for (const a of batchResults) analysisByIndex.set(a.lectureIndex, a);
    processed += batch.length;
    logger.info(`  Analyzed ${processed}/${total} lectures`, {
      stage: 'analyzing',
      processed,
      total,
      currentLecture: batch[batch.length - 1]?.lecture.title,
    });
    if (i + BATCH_SIZE < valid.length) {
      await new Promise((res) => setTimeout(res, BATCH_DELAY_MS));
    }
  }

  return results.map((r) => analysisByIndex.get(r.lecture.index)!).filter(Boolean);
}

// ─── Pass 2: course synthesis (Sonnet) ───────────────────────────────────────

const PASS2_SCHEMA = `{
  "conceptGraph": [{ "concept": string, "dependsOn": string[], "taughtIn": number[] }],
  "redundancyClusters": [{ "concept": string, "keepLecture": number, "skipLectures": number[], "reason": string }],
  "compressedPath": [{ "phase": string, "goal": string, "lectures": number[], "activeTasks": string[] }],
  "projectDeliverables": [{ "title": string, "description": string, "requiredConcepts": string[], "estimatedHours": number }],
  "skipList": [{ "lectureIndex": number, "reason": string }],
  "totalHoursOriginal": number,
  "totalHoursOptimized": number,
  "compressionRatio": number,
  "executiveSummary": string
}`;

function fallbackSynthesis(analyses: LectureAnalysis[]): AiCourseSynthesis {
  const phase: LearningPhase = {
    phase: 'Full Course',
    goal: 'Complete all lectures',
    lectures: analyses.filter((a) => a.watchValue >= 3).map((a) => a.lectureIndex),
    activeTasks: ['Work through the course material hands-on'],
  };
  const skipList = analyses
    .filter((a) => a.watchValue <= 2)
    .map((a) => ({ lectureIndex: a.lectureIndex, reason: a.canBeReplaced ?? 'Low watch value' }));
  const originalHours = Math.round((analyses.length * 0.5) * 10) / 10;
  const optimizedHours = Math.round((phase.lectures.length * 0.5) * 10) / 10;
  return {
    conceptGraph: [],
    redundancyClusters: [],
    compressedPath: [phase],
    projectDeliverables: [],
    skipList,
    totalHoursOriginal: originalHours,
    totalHoursOptimized: optimizedHours,
    compressionRatio: Math.round(((originalHours - optimizedHours) / originalHours) * 100),
    executiveSummary:
      'AI synthesis unavailable — showing rule-based fallback. Re-run to retry.',
  };
}

async function runPass2(
  analyses: LectureAnalysis[],
  courseTitle: string,
  focusPrompt: string | undefined,
  logger: AppLogger,
): Promise<AiCourseSynthesis> {
  const client = getAiClient();

  const systemParts = [
    'You are an expert learning optimizer and curriculum designer.',
    'Goal: create a maximally efficient learning path — same skills, far less time.',
    'Strategy: eliminate redundancy, reorder by concept dependencies, replace passive watching with active building.',
    'Return ONLY valid JSON with no markdown fences or extra text.',
  ];
  if (focusPrompt) systemParts.push(`\nUser learning focus: ${focusPrompt}`);

  const userPrompt = `Course: "${courseTitle}" (${analyses.length} lectures total)

Per-lecture analyses:
${JSON.stringify(analyses, null, 2)}

Return a JSON object matching this schema exactly:
${PASS2_SCHEMA}

Rules:
- compressionRatio: integer percentage of time saved (e.g. 45 = 45% shorter)
- compressedPath: 3–7 phases with clear goals; activeTasks are specific things to build, NOT "watch lecture X"
- skipList: lectures where watchValue ≤ 2 AND concepts are covered elsewhere or have no skill value
- redundancyClusters: only when 2+ lectures teach genuinely identical concepts
- conceptGraph: key concepts only, with honest dependency relationships
- executiveSummary: 3–4 sentences describing the optimized strategy and why it works`;

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 4096,
    system: systemParts.join('\n'),
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '{}';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

  try {
    return JSON.parse(jsonStr) as AiCourseSynthesis;
  } catch (err) {
    logger.warn(`Pass 2 JSON parse failed (${String(err)}), using fallback synthesis`);
    return fallbackSynthesis(analyses);
  }
}

// ─── Markdown writer ─────────────────────────────────────────────────────────

export function aiPlanToMarkdown(plan: AiLearningPlan): string {
  const { synthesis, courseTitle } = plan;
  const lines: string[] = [];

  lines.push(`# AI-Optimized Learning Plan: ${courseTitle}`);
  lines.push('');
  lines.push(
    `> Generated by Claude (${plan.model}) on ${new Date(plan.generatedAt).toLocaleDateString()}`,
  );
  if (plan.focusPrompt) lines.push(`> Focus: ${plan.focusPrompt}`);
  lines.push('');

  lines.push('## Executive Summary');
  lines.push('');
  lines.push(synthesis.executiveSummary);
  lines.push('');

  lines.push('## Compression');
  lines.push('');
  lines.push('| | Hours |');
  lines.push('|---|---|');
  lines.push(`| Original | ${synthesis.totalHoursOriginal}h |`);
  lines.push(`| Optimized | ${synthesis.totalHoursOptimized}h |`);
  lines.push(
    `| Saved | ${(synthesis.totalHoursOriginal - synthesis.totalHoursOptimized).toFixed(1)}h (${synthesis.compressionRatio}%) |`,
  );
  lines.push('');

  lines.push('## Learning Phases');
  lines.push('');
  for (let i = 0; i < synthesis.compressedPath.length; i++) {
    const phase = synthesis.compressedPath[i]!;
    lines.push(`### Phase ${i + 1}: ${phase.phase}`);
    lines.push('');
    lines.push(`**Goal:** ${phase.goal}`);
    lines.push('');
    if (phase.lectures.length > 0) {
      lines.push(`**Lectures:** ${phase.lectures.map((n) => String(n).padStart(3, '0')).join(', ')}`);
      lines.push('');
    }
    if (phase.activeTasks.length > 0) {
      lines.push('**Active Tasks:**');
      for (const task of phase.activeTasks) lines.push(`- [ ] ${task}`);
      lines.push('');
    }
  }

  if (synthesis.projectDeliverables.length > 0) {
    lines.push('## Projects');
    lines.push('');
    for (const p of synthesis.projectDeliverables) {
      lines.push(`### ${p.title}`);
      lines.push('');
      lines.push(p.description);
      lines.push('');
      lines.push(
        `**Est. time:** ${p.estimatedHours}h  |  **Requires:** ${p.requiredConcepts.join(', ')}`,
      );
      lines.push('');
    }
  }

  if (synthesis.redundancyClusters.length > 0) {
    lines.push('## Redundancy Report');
    lines.push('');
    lines.push('| Concept | Keep | Skip | Reason |');
    lines.push('|---|---|---|---|');
    for (const c of synthesis.redundancyClusters) {
      lines.push(
        `| ${c.concept} | ${String(c.keepLecture).padStart(3, '0')} | ${c.skipLectures.map((n) => String(n).padStart(3, '0')).join(', ')} | ${c.reason} |`,
      );
    }
    lines.push('');
  }

  if (synthesis.skipList.length > 0) {
    lines.push('## Skip List');
    lines.push('');
    lines.push('| Lecture | Reason |');
    lines.push('|---|---|');
    for (const e of synthesis.skipList) {
      lines.push(`| ${String(e.lectureIndex).padStart(3, '0')} | ${e.reason} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function generateAndSaveAiPlan(
  results: LectureResult[],
  courseTitle: string,
  outputDir: string,
  transcriptsPath: string,
  focusPrompt: string | undefined,
  logger: AppLogger = consoleLogger,
): Promise<AiLearningPlan> {
  // Validate API key early
  getAiClient();

  const estimate = estimateAnalysisCost(results);
  logger.info(
    `Estimated cost: ${estimate.formatted} (${estimate.lectureCount} lectures — Pass 1: Haiku, Pass 2: Sonnet)`,
    { stage: 'analyzing', processed: 0, total: estimate.lectureCount },
  );

  // Pass 1
  logger.info(`Running per-lecture analysis on ${estimate.lectureCount} lectures...`);
  const lectureAnalyses = await runPass1(results, logger);

  // Pass 2
  logger.info('Synthesizing course-level learning path...', { stage: 'synthesizing' });
  const synthesis = await runPass2(lectureAnalyses, courseTitle, focusPrompt, logger);

  const plan: AiLearningPlan = {
    courseTitle,
    generatedAt: new Date().toISOString(),
    model: `${HAIKU_MODEL} (analysis) + ${SONNET_MODEL} (synthesis)`,
    transcriptsHash: hashFile(transcriptsPath),
    focusPrompt,
    lectureAnalyses,
    synthesis,
  };

  const jsonPath = path.join(outputDir, 'ai-learning-plan.json');
  const mdPath = path.join(outputDir, 'ai-learning-plan.md');
  writeFile(jsonPath, JSON.stringify(plan, null, 2));
  writeFile(mdPath, aiPlanToMarkdown(plan));

  return plan;
}

export { isCacheValid };
