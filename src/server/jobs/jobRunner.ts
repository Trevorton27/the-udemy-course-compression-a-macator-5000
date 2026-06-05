import * as path from 'path';
import { launchBrowser } from '../../browser.js';
import { ensureLoggedIn } from '../../auth.js';
import { buildCourseMap } from '../../course-map.js';
import { extractTranscript } from '../../transcript-extractor.js';
import { toLectureMarkdown, toCombinedMarkdown } from '../../formatter.js';
import {
  lectureOutputPath,
  fileExists,
  writeFile,
  saveCourseMap,
  saveTranscriptsJson,
  saveCombinedMarkdown,
  saveSkipped,
  saveErrors,
  courseOutputDir,
  OUTPUT_ROOT,
} from '../../storage.js';
import type { LectureResult } from '../../types.js';
import type { Lecture } from '../../types.js';
import { loadTranscriptsJson, buildInventory, deriveCourseTitle } from '../../optimizer/courseInventory.js';
import { classifyCourse } from '../../optimizer/contentClassifier.js';
import { generateStudyPlan } from '../../optimizer/studyPlanGenerator.js';
import { generateBuildFirstPlan } from '../../optimizer/buildFirstPlanGenerator.js';
import { writeInventory, writeOptimizedPlan, writeSelectedPlan, writeBuildFirstPlan } from '../../optimizer/markdownWriter.js';
import { createJobLogger } from '../../utils/logger.js';
import { appendLog, sendSseDone, type Job } from './jobStore.js';
import { buildLibraryEntryFromDir, upsertLibraryEntry } from '../../storage/courseLibrary.js';

const DELAY_MIN_MS = parseInt(process.env['DELAY_MIN_MS'] ?? '1500', 10);
const DELAY_MAX_MS = parseInt(process.env['DELAY_MAX_MS'] ?? '3500', 10);
const PROFILE_DIR = process.env['UDEMY_PROFILE_DIR'] ?? './browser-profile';

// Prevent concurrent scrape sessions
let scrapeActive = false;

export async function startScrapeJob(job: Job): Promise<void> {
  if (scrapeActive) {
    job.status = 'failed';
    const logger = createJobLogger(job.id, (e) => appendLog(job, e));
    logger.error('Another scrape job is already running. Please wait for it to finish.', { stage: 'failed' });
    sendSseDone(job);
    return;
  }

  scrapeActive = true;
  job.status = 'running';

  const logger = createJobLogger(job.id, (e) => appendLog(job, e));

  const params = job.params;
  if (params.type !== 'scrape') return;

  const { context, page } = await launchBrowser(PROFILE_DIR);

  let outputDir = '';

  try {
    const loginConfirmation = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        job.status = 'waiting-for-login';
        job.loginResolver = resolve;
        logger.info('Waiting for login confirmation from UI...', { stage: 'waiting' });
      });
    };

    await ensureLoggedIn(page, logger, loginConfirmation);
    job.status = 'running';

    logger.info('Building course map...', { stage: 'discovering' });
    const courseMap = await buildCourseMap(page, params.url, logger);
    saveCourseMap(courseMap.courseTitle, courseMap, logger);
    outputDir = courseOutputDir(courseMap.courseTitle);
    job.outputFiles.push(path.join(outputDir, 'course-map.json'));

    const { courseTitle, lectures } = courseMap;
    const results: LectureResult[] = [];

    logger.info(`\nStarting transcript extraction for ${lectures.length} lectures...\n`, {
      stage: 'extracting',
      processed: 0,
      total: lectures.length,
    });

    for (let i = 0; i < lectures.length; i++) {
      const lecture = lectures[i]!;
      const outPath = lectureOutputPath(courseTitle, lecture);
      const label = `[${String(lecture.index).padStart(3, '0')}] ${lecture.title}`;

      if (fileExists(outPath)) {
        logger.info(`  SKIP (already exists): ${label}`, {
          stage: 'extracting',
          currentLecture: lecture.title,
          processed: i,
          total: lectures.length,
        });
        results.push({
          lecture,
          rows: [],
          skipped: true,
          skipReason: 'Already extracted (resume mode).',
        });
        continue;
      }

      logger.info(`  Extracting: ${label}`, {
        stage: 'extracting',
        currentLecture: lecture.title,
        processed: i,
        total: lectures.length,
      });
      const result = await extractTranscript(page, lecture, DELAY_MIN_MS, DELAY_MAX_MS, logger);
      results.push(result);

      if (result.error) {
        logger.error(`    ERROR: ${result.error}`);
      } else if (result.skipped) {
        logger.info(`    SKIPPED: ${result.skipReason}`);
      } else {
        logger.info(`    OK — ${result.rows.length} cues`);
        const md = toLectureMarkdown(result);
        writeFile(outPath, md);
      }
    }

    saveTranscriptsJson(courseTitle, results, logger);
    saveCombinedMarkdown(courseTitle, toCombinedMarkdown(courseTitle, results), logger);
    saveSkipped(courseTitle, results, logger);
    saveErrors(courseTitle, results, logger);

    const transcriptsPath = path.join(outputDir, 'transcripts.json');
    job.outputFiles.push(transcriptsPath);
    job.outputFiles.push(path.join(outputDir, 'combined-transcript.md'));

    if (
      params.mode === 'scan' ||
      params.mode === 'optimize-all' ||
      params.mode === 'optimize-selected' ||
      params.mode === 'optimize-build-first'
    ) {
      logger.info('\nRunning scan/inventory...', { stage: 'building-inventory' });
      const inventory = buildInventory(results, courseTitle);
      const classified = classifyCourse(inventory, results);
      writeInventory(outputDir, inventory, logger);
      job.outputFiles.push(path.join(outputDir, 'course-inventory.json'));
      job.outputFiles.push(path.join(outputDir, 'course-inventory.md'));

      if (params.mode === 'optimize-all') {
        logger.info('\nGenerating optimized study plan...', { stage: 'generating-plan' });
        const plan = generateStudyPlan(inventory, classified);
        writeOptimizedPlan(outputDir, plan, courseTitle, logger);
        job.outputFiles.push(path.join(outputDir, 'optimized-learning-plan.md'));
      } else if (params.mode === 'optimize-build-first') {
        logger.info('\nGenerating build-first study plan...', { stage: 'generating-plan' });
        const plan = generateBuildFirstPlan(inventory, classified);
        writeBuildFirstPlan(outputDir, plan, courseTitle, logger);
        job.outputFiles.push(path.join(outputDir, 'build-first-plan.md'));
      }
      // optimize-selected: frontend fetches inventory JSON, user selects, then second optimize job
    }

    const extracted = results.filter((r) => !r.skipped && !r.error).length;
    const skipped = results.filter((r) => r.skipped).length;
    const errors = results.filter((r) => r.error).length;
    logger.success(`Done. Extracted: ${extracted}, Skipped: ${skipped}, Errors: ${errors}`, { stage: 'complete' });

    job.status = 'complete';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`, { stage: 'failed' });
    job.status = 'failed';
  } finally {
    scrapeActive = false;
    await context.close();
    if (outputDir) {
      try {
        upsertLibraryEntry(buildLibraryEntryFromDir(outputDir, job.status as 'complete' | 'failed'));
      } catch {
        // best effort
      }
    }
    sendSseDone(job);
  }
}

export async function startOptimizeJob(job: Job): Promise<void> {
  job.status = 'running';
  const logger = createJobLogger(job.id, (e) => appendLog(job, e));

  const params = job.params;
  if (params.type !== 'optimize') return;

  try {
    const resolvedPath = path.resolve(params.transcriptsPath);
    const dir = path.dirname(resolvedPath);

    logger.info(`Loading transcripts from: ${resolvedPath}`, { stage: 'discovering' });
    const results = loadTranscriptsJson(resolvedPath);
    logger.info(`Loaded ${results.length} lecture results`);

    const courseTitle = deriveCourseTitle(dir);
    logger.info(`Course: ${courseTitle}`);

    logger.info('Building inventory...', { stage: 'building-inventory' });
    const inventory = buildInventory(results, courseTitle);
    const classified = classifyCourse(inventory, results);
    writeInventory(dir, inventory, logger);
    job.outputFiles.push(path.join(dir, 'course-inventory.json'));
    job.outputFiles.push(path.join(dir, 'course-inventory.md'));

    logger.info('Generating study plan...', { stage: 'generating-plan' });
    if (params.mode === 'selected' && params.criteria) {
      const criteria = {
        sections: params.criteria.sections?.map(Number),
        technologies: params.criteria.technologies,
        keywords: params.criteria.keyword ? [params.criteria.keyword] : undefined,
        lectures: params.criteria.lectures?.map(Number),
      };
      const plan = generateStudyPlan(inventory, classified, criteria);
      writeSelectedPlan(dir, plan, courseTitle, logger);
      job.outputFiles.push(path.join(dir, 'selected-learning-plan.md'));
    } else if (params.mode === 'build-first') {
      const plan = generateBuildFirstPlan(inventory, classified);
      writeBuildFirstPlan(dir, plan, courseTitle, logger);
      job.outputFiles.push(path.join(dir, 'build-first-plan.md'));
    } else {
      const plan = generateStudyPlan(inventory, classified);
      writeOptimizedPlan(dir, plan, courseTitle, logger);
      job.outputFiles.push(path.join(dir, 'optimized-learning-plan.md'));
    }

    logger.success('Optimize complete.', { stage: 'complete' });
    job.status = 'complete';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`, { stage: 'failed' });
    job.status = 'failed';
  } finally {
    try {
      const dir = path.dirname(path.resolve(params.transcriptsPath));
      upsertLibraryEntry(buildLibraryEntryFromDir(dir, job.status as 'complete' | 'failed'));
    } catch {
      // best effort
    }
    sendSseDone(job);
  }
}

export async function startRetryJob(job: Job): Promise<void> {
  if (scrapeActive) {
    job.status = 'failed';
    const logger = createJobLogger(job.id, (e) => appendLog(job, e));
    logger.error('Another scrape job is already running. Please wait for it to finish.', { stage: 'failed' });
    sendSseDone(job);
    return;
  }

  scrapeActive = true;
  job.status = 'running';

  const logger = createJobLogger(job.id, (e) => appendLog(job, e));

  const params = job.params;
  if (params.type !== 'retry') return;

  const { context, page } = await launchBrowser(PROFILE_DIR);

  try {
    const loginConfirmation = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        job.status = 'waiting-for-login';
        job.loginResolver = resolve;
        logger.info('Waiting for login confirmation from UI...', { stage: 'waiting' });
      });
    };

    await ensureLoggedIn(page, logger, loginConfirmation);
    job.status = 'running';

    const resolvedPath = path.resolve(params.transcriptsPath);
    const outputDir = path.dirname(resolvedPath);
    const courseTitle = deriveCourseTitle(outputDir);

    const allResults = loadTranscriptsJson(resolvedPath);
    const resultsByIndex = new Map<number, LectureResult>();
    for (const r of allResults) {
      resultsByIndex.set(r.lecture.index, r);
    }

    const total = params.lectures.length;
    logger.info(`Retrying ${total} failed lectures...`, {
      stage: 'extracting',
      processed: 0,
      total,
    });

    for (let i = 0; i < params.lectures.length; i++) {
      const failedLecture = params.lectures[i]!;
      const lecture: Lecture = {
        index: failedLecture.lectureIndex,
        title: failedLecture.title,
        url: failedLecture.url,
        sectionTitle: failedLecture.sectionTitle,
        sectionIndex: failedLecture.sectionIndex,
      };
      const label = `[${String(lecture.index).padStart(3, '0')}] ${lecture.title}`;
      logger.info(`  Retrying: ${label}`, {
        stage: 'extracting',
        currentLecture: lecture.title,
        processed: i,
        total,
      });

      const result = await extractTranscript(page, lecture, DELAY_MIN_MS, DELAY_MAX_MS, logger);

      if (result.error) {
        logger.error(`    ERROR: ${result.error}`);
        resultsByIndex.set(lecture.index, result);
      } else if (result.skipped) {
        logger.info(`    SKIPPED: ${result.skipReason}`);
        resultsByIndex.set(lecture.index, result);
      } else {
        logger.info(`    OK — ${result.rows.length} cues`);
        const outPath = lectureOutputPath(courseTitle, lecture);
        writeFile(outPath, toLectureMarkdown(result));
        resultsByIndex.set(lecture.index, result);
      }
    }

    const updatedResults = allResults.map((r) => resultsByIndex.get(r.lecture.index) ?? r);
    saveTranscriptsJson(courseTitle, updatedResults, logger);
    saveErrors(courseTitle, updatedResults, logger);

    job.outputFiles.push(resolvedPath);

    logger.success('Retry complete.', { stage: 'complete' });
    job.status = 'complete';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`, { stage: 'failed' });
    job.status = 'failed';
  } finally {
    scrapeActive = false;
    await context.close();
    try {
      const dir = path.dirname(path.resolve(params.transcriptsPath));
      upsertLibraryEntry(buildLibraryEntryFromDir(dir, job.status as 'complete' | 'failed'));
    } catch {
      // best effort
    }
    sendSseDone(job);
  }
}

/** Resolve an output file path to a path relative to OUTPUT_ROOT for safe download */
export function toRelativePath(absPath: string): string {
  return path.relative(OUTPUT_ROOT, absPath);
}
