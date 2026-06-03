import * as path from 'path';
import { loadTranscriptsJson, buildInventory, deriveCourseTitle } from './optimizer/courseInventory.js';
import { classifyCourse } from './optimizer/contentClassifier.js';
import { writeInventory } from './optimizer/markdownWriter.js';

async function main(): Promise<void> {
  const transcriptsPath = process.argv[2];

  if (!transcriptsPath) {
    console.error('Usage: tsx src/scan.ts <path-to-transcripts.json>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(transcriptsPath);
  const dir = path.dirname(resolvedPath);

  console.log(`Loading transcripts from: ${resolvedPath}`);
  const results = loadTranscriptsJson(resolvedPath);
  console.log(`Loaded ${results.length} lecture results`);

  const courseTitle = deriveCourseTitle(dir);
  console.log(`Course: ${courseTitle}`);

  const inventory = buildInventory(results, courseTitle);
  classifyCourse(inventory, results);

  writeInventory(dir, inventory);

  console.log('\nScan complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
