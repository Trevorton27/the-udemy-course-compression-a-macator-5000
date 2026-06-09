import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadCourseLibrary,
  saveCourseLibrary,
  upsertLibraryEntry,
  deleteLibraryEntry,
} from './courseLibrary.js';
import type { CourseLibraryEntry } from '../types/libraryTypes.js';

function tmpLibraryPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'course-lib-test-'));
  return path.join(dir, 'course-library.json');
}

function makeEntry(id: string, overrides: Partial<CourseLibraryEntry> = {}): CourseLibraryEntry {
  return {
    id,
    courseTitle: `Course ${id}`,
    sourceUrl: `https://udemy.com/course/${id}`,
    outputDir: `/tmp/output/${id}`,
    lastRunDate: new Date().toISOString(),
    status: 'complete',
    totalLectures: 10,
    transcriptCount: 8,
    skippedCount: 1,
    failedCount: 1,
    hasInventory: true,
    hasOptimizedPlan: false,
    hasSelectedPlan: false,
    hasBuildFirstPlan: false,
    hasAiPlan: false,
    ...overrides,
  };
}

test('loadCourseLibrary returns default when file is missing', () => {
  const libPath = tmpLibraryPath();
  const library = loadCourseLibrary(libPath);
  assert.deepEqual(library, { version: 1, entries: [] });
});

test('upsertLibraryEntry inserts new entry', () => {
  const libPath = tmpLibraryPath();
  const entry = makeEntry('test-course-1');
  upsertLibraryEntry(entry, libPath);
  const library = loadCourseLibrary(libPath);
  assert.equal(library.entries.length, 1);
  assert.equal(library.entries[0]?.id, 'test-course-1');
});

test('upsertLibraryEntry replaces existing entry with same id', () => {
  const libPath = tmpLibraryPath();
  const original = makeEntry('test-course-2', { courseTitle: 'Original Title' });
  upsertLibraryEntry(original, libPath);
  const updated = makeEntry('test-course-2', { courseTitle: 'Updated Title' });
  upsertLibraryEntry(updated, libPath);
  const library = loadCourseLibrary(libPath);
  assert.equal(library.entries.length, 1);
  assert.equal(library.entries[0]?.courseTitle, 'Updated Title');
});

test('deleteLibraryEntry removes existing entry and returns true', () => {
  const libPath = tmpLibraryPath();
  upsertLibraryEntry(makeEntry('test-course-3'), libPath);
  const result = deleteLibraryEntry('test-course-3', libPath);
  assert.equal(result, true);
  const library = loadCourseLibrary(libPath);
  assert.equal(library.entries.length, 0);
});

test('deleteLibraryEntry returns false when id not found', () => {
  const libPath = tmpLibraryPath();
  upsertLibraryEntry(makeEntry('test-course-4'), libPath);
  const result = deleteLibraryEntry('nonexistent-id', libPath);
  assert.equal(result, false);
  const library = loadCourseLibrary(libPath);
  assert.equal(library.entries.length, 1);
});
