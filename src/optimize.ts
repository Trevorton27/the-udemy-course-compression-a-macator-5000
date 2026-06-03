import * as path from 'path';
import { Command } from 'commander';
import { loadTranscriptsJson, buildInventory, deriveCourseTitle } from './optimizer/courseInventory.js';
import { classifyCourse } from './optimizer/contentClassifier.js';
import { generateStudyPlan } from './optimizer/studyPlanGenerator.js';
import { writeInventory, writeOptimizedPlan, writeSelectedPlan } from './optimizer/markdownWriter.js';
import { promptForSelection } from './optimizer/selectionPrompt.js';

async function run(transcriptsPath: string, opts: { select: boolean }): Promise<void> {
  const resolvedPath = path.resolve(transcriptsPath);
  const dir = path.dirname(resolvedPath);

  console.log(`Loading transcripts from: ${resolvedPath}`);
  const results = loadTranscriptsJson(resolvedPath);
  console.log(`Loaded ${results.length} lecture results`);

  const courseTitle = deriveCourseTitle(dir);
  console.log(`Course: ${courseTitle}`);

  const inventory = buildInventory(results, courseTitle);
  const classified = classifyCourse(inventory, results);

  writeInventory(dir, inventory);

  if (opts.select) {
    const criteria = await promptForSelection(inventory);
    const plan = generateStudyPlan(inventory, classified, criteria);
    writeSelectedPlan(dir, plan, courseTitle);
  } else {
    const plan = generateStudyPlan(inventory, classified);
    writeOptimizedPlan(dir, plan, courseTitle);
  }

  console.log('\nOptimize complete.');
}

const program = new Command();

program
  .name('optimize')
  .description('Generate an optimized learning plan from extracted Udemy transcripts.')
  .version('1.0.0')
  .argument('<transcriptsPath>', 'Path to transcripts.json file')
  .option('--select', 'Interactive selection mode - choose sections, technologies, and keywords')
  .action((transcriptsPath: string, opts: { select: boolean }) => {
    run(transcriptsPath, opts).catch((err) => {
      console.error('Fatal error:', err instanceof Error ? err.message : err);
      process.exit(1);
    });
  });

program.parse();
