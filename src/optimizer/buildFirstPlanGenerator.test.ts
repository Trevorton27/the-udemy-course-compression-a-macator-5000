import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBuildFirstPlan } from './buildFirstPlanGenerator.js';
import type { CourseInventory, ClassifiedLecture, InventoryLecture } from '../types/optimizerTypes.js';
import type { LectureResult } from '../types.js';

function makeLecture(
  idx: number,
  title: string,
  classification: 'build' | 'watch' | 'skim' | 'skip',
): { inventory: InventoryLecture; classified: ClassifiedLecture } {
  const lectureResult: LectureResult = {
    lecture: { index: idx, title, url: '', sectionTitle: 'Section 1', sectionIndex: 1 },
    rows: [],
    skipped: false,
  };
  const invLecture: InventoryLecture = {
    lectureIndex: idx,
    title,
    url: '',
    sectionTitle: 'Section 1',
    sectionIndex: 1,
    classification,
    detectedItems: [],
  };
  const classifiedLecture: ClassifiedLecture = {
    lecture: lectureResult,
    classification,
    confidence: 0.9,
    reasons: [],
  };
  return { inventory: invLecture, classified: classifiedLecture };
}

function makeInventory(lectures: InventoryLecture[]): CourseInventory {
  return {
    courseTitle: 'Test Course',
    sections: [{ title: 'Section 1', sectionIndex: 1, lectures }],
    technologies: ['react'],
    projects: [],
    concepts: [],
    frameworks: [],
    libraries: [],
    handsOnTasks: [],
  };
}

test('build lectures appear before watch lectures in watchCarefully', () => {
  const watch1 = makeLecture(1, 'Watch Lecture A', 'watch');
  const build1 = makeLecture(2, 'Build a Project', 'build');
  const watch2 = makeLecture(3, 'Watch Lecture B', 'watch');
  const build2 = makeLecture(4, 'Implement Feature', 'build');

  const inventory = makeInventory([watch1.inventory, build1.inventory, watch2.inventory, build2.inventory]);
  const classified = [watch1.classified, build1.classified, watch2.classified, build2.classified];

  const plan = generateBuildFirstPlan(inventory, classified);

  // All build lectures should come before all watch lectures
  const watchCarefullyTitles = plan.watchCarefully.map((l) => l.title);
  const lastBuildIdx = watchCarefullyTitles.lastIndexOf('Implement Feature');
  const firstWatchIdx = watchCarefullyTitles.indexOf('Watch Lecture A');
  assert.ok(lastBuildIdx < firstWatchIdx, `Last build (${lastBuildIdx}) should be before first watch (${firstWatchIdx})`);
});

test('intro/outro/bonus titled lectures are demoted to skip', () => {
  const intro = makeLecture(1, 'Introduction to the Course', 'watch');
  const build = makeLecture(2, 'Build a REST API', 'build');
  const bonus = makeLecture(3, 'Bonus: Extra Resources', 'watch');
  const outro = makeLecture(4, 'Course Outro', 'skip');

  const inventory = makeInventory([intro.inventory, build.inventory, bonus.inventory, outro.inventory]);
  const classified = [intro.classified, build.classified, bonus.classified, outro.classified];

  const plan = generateBuildFirstPlan(inventory, classified);

  const skipTitles = plan.skip.map((l) => l.title);
  assert.ok(skipTitles.includes('Introduction to the Course'), 'intro should be in skip');
  assert.ok(skipTitles.includes('Bonus: Extra Resources'), 'bonus should be in skip');
  assert.ok(skipTitles.includes('Course Outro'), 'outro should be in skip');

  const watchTitles = plan.watchCarefully.map((l) => l.title);
  assert.ok(!watchTitles.includes('Introduction to the Course'), 'intro should not be in watchCarefully');
});

test('plan mode field is build-first', () => {
  const build = makeLecture(1, 'Build Something', 'build');
  const inventory = makeInventory([build.inventory]);
  const classified = [build.classified];

  const plan = generateBuildFirstPlan(inventory, classified);
  assert.equal(plan.mode, 'build-first');
});
