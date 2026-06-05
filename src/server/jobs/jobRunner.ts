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
import { loadTranscriptsJson, buildInventory, deriveCourseTitle } from '../../optimizer/courseInventory.js';
import { classifyCourse } from '../../optimizer/contentClassifier.js';
import { generateStudyPlan } from '../../optimizer/studyPlanGenerator.js';
import { writeInventory, writeOptimizedPlan, writeSelectedPlan } from '../../optimizer/markdownWriter.js';
import { createJobLogger } from '../../utils/logger.js';
import { appendLog, sendSseDone, type Job } from './jobStore.js';

const DELAY_MIN_MS = parseInt(process.env['DELAY_MIN_MS'] ?? '1500', 10);
const DELAY_MAX_MS = parseInt(process.env['DELAY_MAX_MS'] ?? '3500', 10);
const PROFILE_DIR = process.env['UDEMY_PROFILE_DIR'] ?? './browser-profile';

// Prevent concurrent scrape sessions
let scrapeActive = false;

export async function startScrapeJob(job: Job): Promise<void> {
  if (scrapeActive) {
    job.status = 'failed';
    const logger = createJobLogger(job.id, (e) => appendLog(job, e));
    logger.error('Another scrape job is already running. Please wait for it to finish.');
    sendSseDone(job);
    return;
  }

  scrapeActive = true;
  job.status = 'running';

  const logger = createJobLogger(job.id, (e) => appendLog(job, e));

  const params = job.params;
  if (params.type !== 'scrape') return;

  const { context, page } = await launchBrowser(PROFILE_DIR);

  try {
    // Provide a way for the web UI to signal login completion
    const loginConfirmation = (): Promise<void> => {
      return new Promise<void>((resolve) => {
        job.status = 'waiting-for-login';
        job.loginResolver = resolve;
        logger.info('Waiting for login confirmation from UI...');
      });
    };

    await ensureLoggedIn(page, logger, loginConfirmation);
    job.status = 'running';

    const courseMap = await buildCourseMap(page, params.url, logger);
    saveCourseMap(courseMap.courseTitle, courseMap, logger);
    job.outputFiles.push(path.join(courseOutputDir(courseMap.courseTitle), 'course-map.json'));

    const { courseTitle, lectures } = courseMap;
    const results: LectureResult[] = [];

    logger.info(`\nStarting transcript extraction for ${lectures.length} lectures...\n`);

    for (const lecture of lectures) {
      const outPath = lectureOutputPath(courseTitle, lecture);
      const label = `[${String(lecture.index).padStart(3, '0')}] ${lecture.title}`;

      if (fileExists(outPath)) {
        logger.info(`  SKIP (already exists): ${label}`);
        results.push({
          lecture,
          rows: [],
          skipped: true,
          skipReason: 'Already extracted (resume mode).',
        });
        continue;
      }

      logger.info(`  Extracting: ${label}`);
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

    const outputDir = courseOutputDir(courseTitle);
    const transcriptsPath = path.join(outputDir, 'transcripts.json');
    job.outputFiles.push(transcriptsPath);
    job.outputFiles.push(path.join(outputDir, 'combined-transcript.md'));

    if (params.mode === 'scan' || params.mode === 'optimize-all' || params.mode === 'optimize-selected') {
      logger.info('\nRunning scan/inventory...');
      const inventory = buildInventory(results, courseTitle);
      const classified = classifyCourse(inventory, results);
      writeInventory(outputDir, inventory, logger);
      job.outputFiles.push(path.join(outputDir, 'course-inventory.json'));
      job.outputFiles.push(path.join(outputDir, 'course-inventory.md'));

      if (params.mode === 'optimize-all') {
        const plan = generateStudyPlan(inventory, classified);
        writeOptimizedPlan(outputDir, plan, courseTitle, logger);
        job.outputFiles.push(path.join(outputDir, 'optimized-learning-plan.md'));
      }
      // optimize-selected: frontend fetches inventory JSON, user selects, then second optimize job
    }

    const extracted = results.filter((r) => !r.skipped && !r.error).length;
    const skipped = results.filter((r) => r.skipped).length;
    const errors = results.filter((r) => r.error).length;
    logger.success(`Done. Extracted: ${extracted}, Skipped: ${skipped}, Errors: ${errors}`);

    job.status = 'complete';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`);
    job.status = 'failed';
  } finally {
    scrapeActive = false;
    await context.close();
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

    logger.info(`Loading transcripts from: ${resolvedPath}`);
    const results = loadTranscriptsJson(resolvedPath);
    logger.info(`Loaded ${results.length} lecture results`);

    const courseTitle = deriveCourseTitle(dir);
    logger.info(`Course: ${courseTitle}`);

    const inventory = buildInventory(results, courseTitle);
    const classified = classifyCourse(inventory, results);
    writeInventory(dir, inventory, logger);
    job.outputFiles.push(path.join(dir, 'course-inventory.json'));
    job.outputFiles.push(path.join(dir, 'course-inventory.md'));

    if (params.mode === 'selected' && params.criteria) {
      const criteria = {
        sections: params.criteria.sections?.map(Number),
        technologies: params.criteria.technologies,
        keywords: params.criteria.keyword ? [params.criteria.keyword] : undefined,
      };
      const plan = generateStudyPlan(inventory, classified, criteria);
      writeSelectedPlan(dir, plan, courseTitle, logger);
      job.outputFiles.push(path.join(dir, 'selected-learning-plan.md'));
    } else {
      const plan = generateStudyPlan(inventory, classified);
      writeOptimizedPlan(dir, plan, courseTitle, logger);
      job.outputFiles.push(path.join(dir, 'optimized-learning-plan.md'));
    }

    logger.success('Optimize complete.');
    job.status = 'complete';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Fatal error: ${msg}`);
    job.status = 'failed';
  } finally {
    sendSseDone(job);
  }
}

/** Resolve an output file path to a path relative to OUTPUT_ROOT for safe download */
export function toRelativePath(absPath: string): string {
  return path.relative(OUTPUT_ROOT, absPath);
}
