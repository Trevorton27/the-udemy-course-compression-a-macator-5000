import * as fs from 'fs';
import * as path from 'path';
import type { Lecture, LectureResult, CourseMap } from './types.js';
import { type AppLogger, consoleLogger } from './utils/logger.js';

export const OUTPUT_ROOT = path.resolve('./output');

/** Replace filesystem-unsafe characters and collapse whitespace */
export function sanitizeFilename(s: string): string {
  return s
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function courseOutputDir(courseTitle: string): string {
  return path.join(OUTPUT_ROOT, sanitizeFilename(courseTitle));
}

export function sectionOutputDir(courseTitle: string, sectionIndex: number, sectionTitle: string): string {
  const sectionSlug = `${String(sectionIndex).padStart(2, '0')}-${sanitizeFilename(sectionTitle)}`;
  return path.join(courseOutputDir(courseTitle), sectionSlug);
}

export function lectureOutputPath(courseTitle: string, lecture: Lecture): string {
  const dir = sectionOutputDir(courseTitle, lecture.sectionIndex, lecture.sectionTitle);
  const fileSlug = `${String(lecture.index).padStart(3, '0')}-${sanitizeFilename(lecture.title)}.md`;
  return path.join(dir, fileSlug);
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export function writeFile(filePath: string, content: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

export function saveCourseMap(courseTitle: string, courseMap: CourseMap, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const outPath = path.join(courseOutputDir(courseTitle), 'course-map.json');
  writeFile(outPath, JSON.stringify(courseMap, null, 2));
  log.info(`Course map saved: ${outPath}`);
}

export function saveTranscriptsJson(courseTitle: string, results: LectureResult[], logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const outPath = path.join(courseOutputDir(courseTitle), 'transcripts.json');
  writeFile(outPath, JSON.stringify(results, null, 2));
  log.info(`Transcripts JSON saved: ${outPath}`);
}

export function saveCombinedMarkdown(courseTitle: string, content: string, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const outPath = path.join(courseOutputDir(courseTitle), 'combined-transcript.md');
  writeFile(outPath, content);
  log.info(`Combined markdown saved: ${outPath}`);
}

export function saveSkipped(courseTitle: string, results: LectureResult[], logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const skipped = results.filter((r) => r.skipped);
  if (skipped.length === 0) return;
  const outPath = path.join(courseOutputDir(courseTitle), 'skipped.json');
  writeFile(outPath, JSON.stringify(skipped, null, 2));
  log.info(`Skipped lectures saved: ${outPath}`);
}

export function saveErrors(courseTitle: string, results: LectureResult[], logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const errors = results.filter((r) => r.error);
  if (errors.length === 0) return;
  const outPath = path.join(courseOutputDir(courseTitle), 'errors.json');
  writeFile(outPath, JSON.stringify(errors, null, 2));
  log.info(`Errors saved: ${outPath}`);
}
