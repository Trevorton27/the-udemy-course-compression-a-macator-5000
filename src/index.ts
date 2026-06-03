// ETHICAL CONSTRAINT: Personal-use tool for extracting visible transcript text
// from Udemy lectures the user is authorized to access. No paywall bypass,
// no video/audio download, no API interception.
import 'dotenv/config';
import { Command } from 'commander';
import { launchBrowser } from './browser.js';
import { ensureLoggedIn } from './auth.js';
import { buildCourseMap } from './course-map.js';
import { extractTranscript } from './transcript-extractor.js';
import { toLectureMarkdown, toCombinedMarkdown } from './formatter.js';
import {
  lectureOutputPath,
  fileExists,
  writeFile,
  saveCourseMap,
  saveTranscriptsJson,
  saveCombinedMarkdown,
  saveSkipped,
  saveErrors,
} from './storage.js';
import type { LectureResult } from './types.js';
import { courseOutputDir } from './storage.js';
import { buildInventory } from './optimizer/courseInventory.js';
import { classifyCourse } from './optimizer/contentClassifier.js';
import { generateStudyPlan } from './optimizer/studyPlanGenerator.js';
import { writeInventory, writeOptimizedPlan, writeSelectedPlan } from './optimizer/markdownWriter.js';
import { promptForSelection } from './optimizer/selectionPrompt.js';

async function runScanMode(results: LectureResult[], courseTitle: string, outputDir: string): Promise<void> {
  console.log('\nRunning scan mode...');
  const inventory = buildInventory(results, courseTitle);
  classifyCourse(inventory, results);
  writeInventory(outputDir, inventory);
}

async function runOptimizeMode(
  results: LectureResult[],
  courseTitle: string,
  outputDir: string,
  mode: string,
): Promise<void> {
  console.log('\nRunning optimize mode...');
  const inventory = buildInventory(results, courseTitle);
  const classified = classifyCourse(inventory, results);
  writeInventory(outputDir, inventory);

  if (mode === 'selected') {
    const criteria = await promptForSelection(inventory);
    const plan = generateStudyPlan(inventory, classified, criteria);
    writeSelectedPlan(outputDir, plan, courseTitle);
  } else {
    const plan = generateStudyPlan(inventory, classified);
    writeOptimizedPlan(outputDir, plan, courseTitle);
  }
}

const DELAY_MIN_MS = parseInt(process.env['DELAY_MIN_MS'] ?? '1500', 10);
const DELAY_MAX_MS = parseInt(process.env['DELAY_MAX_MS'] ?? '3500', 10);
const PROFILE_DIR = process.env['UDEMY_PROFILE_DIR'] ?? './browser-profile';

function isUdemyCourseUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?udemy\.com\/course\/[^/]+/.test(url);
}

async function run(courseUrl: string, opts: { overwrite: boolean; force: boolean; scan?: boolean; optimize?: string }): Promise<void> {
  if (!isUdemyCourseUrl(courseUrl)) {
    console.error('Error: URL must be a Udemy course URL matching https://www.udemy.com/course/<slug>/');
    process.exit(1);
  }

  const overwrite = opts.overwrite || opts.force;

  const { context, page } = await launchBrowser(PROFILE_DIR);

  try {
    await ensureLoggedIn(page);

    const courseMap = await buildCourseMap(page, courseUrl);
    saveCourseMap(courseMap.courseTitle, courseMap);

    const { courseTitle, lectures } = courseMap;
    const results: LectureResult[] = [];

    console.log(`\nStarting transcript extraction for ${lectures.length} lectures...\n`);

    for (const lecture of lectures) {
      const outPath = lectureOutputPath(courseTitle, lecture);
      const label = `[${String(lecture.index).padStart(3, '0')}] ${lecture.title}`;

      if (!overwrite && fileExists(outPath)) {
        console.log(`  SKIP (already exists): ${label}`);
        // Load existing to include in final outputs
        results.push({
          lecture,
          rows: [],
          skipped: true,
          skipReason: 'Already extracted (resume mode). Use --force to re-extract.',
        });
        continue;
      }

      console.log(`  Extracting: ${label}`);

      const result = await extractTranscript(page, lecture, DELAY_MIN_MS, DELAY_MAX_MS);
      results.push(result);

      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
      } else if (result.skipped) {
        console.log(`    SKIPPED: ${result.skipReason}`);
      } else {
        console.log(`    OK — ${result.rows.length} cues`);
        const md = toLectureMarkdown(result);
        writeFile(outPath, md);
      }
    }

    // Save aggregate outputs
    saveTranscriptsJson(courseTitle, results);
    saveCombinedMarkdown(courseTitle, toCombinedMarkdown(courseTitle, results));
    saveSkipped(courseTitle, results);
    saveErrors(courseTitle, results);

    // Post-scrape optimizer hooks
    const outputDir = courseOutputDir(courseTitle);
    if (opts.scan) {
      await runScanMode(results, courseTitle, outputDir);
    } else if (opts.optimize) {
      await runOptimizeMode(results, courseTitle, outputDir, opts.optimize);
    }

    // Summary
    const extracted = results.filter((r) => !r.skipped && !r.error).length;
    const skipped = results.filter((r) => r.skipped).length;
    const errors = results.filter((r) => r.error).length;

    console.log(`
========================================
  Done.
  Total lectures : ${lectures.length}
  Extracted      : ${extracted}
  Skipped        : ${skipped}
  Errors         : ${errors}
========================================
`);
  } finally {
    await context.close();
  }
}

const program = new Command();

program
  .name('udemy-transcript')
  .description('Extract Udemy course transcripts to local Markdown + JSON files.')
  .version('1.0.0')
  .argument('<courseUrl>', 'Full Udemy course URL (https://www.udemy.com/course/<slug>/)')
  .option('--overwrite', 'Re-extract lectures that already have output files')
  .option('--force', 'Alias for --overwrite')
  .option('--scan', 'Generate course-inventory only after scraping')
  .option('--optimize <mode>', 'Generate study plan after scraping (mode: all | selected)')
  .action((courseUrl: string, opts: { overwrite: boolean; force: boolean; scan?: boolean; optimize?: string }) => {
    run(courseUrl, opts).catch((err) => {
      console.error('Fatal error:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
  });

program.parse();
