import * as fs from 'fs';
import * as path from 'path';
import { OUTPUT_ROOT, ensureDir } from '../storage.js';
import type { LectureResult } from '../types.js';
import type { CourseLibraryEntry, CourseLibrary } from '../types/libraryTypes.js';

const DEFAULT_LIBRARY_PATH = path.join(OUTPUT_ROOT, 'course-library.json');

export function loadCourseLibrary(libraryPath = DEFAULT_LIBRARY_PATH): CourseLibrary {
  try {
    const raw = fs.readFileSync(libraryPath, 'utf-8');
    return JSON.parse(raw) as CourseLibrary;
  } catch {
    return { version: 1, entries: [] };
  }
}

export function saveCourseLibrary(library: CourseLibrary, libraryPath = DEFAULT_LIBRARY_PATH): void {
  ensureDir(path.dirname(libraryPath));
  fs.writeFileSync(libraryPath, JSON.stringify(library, null, 2), 'utf-8');
}

export function upsertLibraryEntry(entry: CourseLibraryEntry, libraryPath = DEFAULT_LIBRARY_PATH): void {
  const library = loadCourseLibrary(libraryPath);
  const idx = library.entries.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    library.entries[idx] = entry;
  } else {
    library.entries.push(entry);
  }
  saveCourseLibrary(library, libraryPath);
}

export function deleteLibraryEntry(id: string, libraryPath = DEFAULT_LIBRARY_PATH): boolean {
  const library = loadCourseLibrary(libraryPath);
  const before = library.entries.length;
  library.entries = library.entries.filter((e) => e.id !== id);
  if (library.entries.length < before) {
    saveCourseLibrary(library, libraryPath);
    return true;
  }
  return false;
}

export function buildLibraryEntryFromDir(
  outputDir: string,
  status: 'complete' | 'failed' | 'partial',
): CourseLibraryEntry {
  const id = path.relative(OUTPUT_ROOT, outputDir);

  let courseTitle = path.basename(outputDir);
  let sourceUrl = '';
  try {
    const courseMap = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'course-map.json'), 'utf-8'),
    ) as { courseTitle?: string; courseUrl?: string };
    if (courseMap.courseTitle) courseTitle = courseMap.courseTitle;
    if (courseMap.courseUrl) sourceUrl = courseMap.courseUrl;
  } catch {
    // course-map may not exist for optimize-only jobs
  }

  let totalLectures = 0;
  let transcriptCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  try {
    const results = JSON.parse(
      fs.readFileSync(path.join(outputDir, 'transcripts.json'), 'utf-8'),
    ) as LectureResult[];
    totalLectures = results.length;
    transcriptCount = results.filter((r) => !r.skipped && !r.error && r.rows.length > 0).length;
    skippedCount = results.filter((r) => r.skipped).length;
    failedCount = results.filter((r) => !!r.error).length;
  } catch {
    // transcripts may not exist
  }

  const hasInventory = fs.existsSync(path.join(outputDir, 'course-inventory.json'));
  const hasOptimizedPlan = fs.existsSync(path.join(outputDir, 'optimized-learning-plan.md'));
  const hasSelectedPlan = fs.existsSync(path.join(outputDir, 'selected-learning-plan.md'));
  const hasBuildFirstPlan = fs.existsSync(path.join(outputDir, 'build-first-plan.md'));
  const hasAiPlan = fs.existsSync(path.join(outputDir, 'ai-learning-plan.json'));

  return {
    id,
    courseTitle,
    sourceUrl,
    outputDir,
    lastRunDate: new Date().toISOString(),
    status,
    totalLectures,
    transcriptCount,
    skippedCount,
    failedCount,
    hasInventory,
    hasOptimizedPlan,
    hasSelectedPlan,
    hasBuildFirstPlan,
    hasAiPlan,
  };
}
