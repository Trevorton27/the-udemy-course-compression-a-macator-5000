import * as path from 'path';
import { writeFile } from '../storage.js';
import type { CourseInventory, StudyPlan } from '../types/optimizerTypes.js';
import { studyPlanToMarkdown } from './studyPlanGenerator.js';
import { buildFirstPlanToMarkdown } from './buildFirstPlanGenerator.js';
import { type AppLogger, consoleLogger } from '../utils/logger.js';

const PROTECTED_FILES = ['transcripts.json', 'combined-transcript.md', 'course-map.json'];

function guardedWrite(filePath: string, content: string): void {
  const basename = path.basename(filePath);
  if (PROTECTED_FILES.includes(basename)) {
    throw new Error(`Refusing to overwrite protected file: ${filePath}`);
  }
  writeFile(filePath, content);
}

function inventoryToMarkdown(inventory: CourseInventory): string {
  const lines: string[] = [];

  lines.push(`# Course Inventory: ${inventory.courseTitle}`);
  lines.push('');

  if (inventory.technologies.length > 0) {
    lines.push('## Technologies');
    lines.push('');
    lines.push(inventory.technologies.map((t) => `\`${t}\``).join(', '));
    lines.push('');
  }

  if (inventory.handsOnTasks.length > 0) {
    lines.push('## Hands-On Tasks');
    lines.push('');
    for (const task of inventory.handsOnTasks) {
      lines.push(`- ${task}`);
    }
    lines.push('');
  }

  if (inventory.projects.length > 0) {
    lines.push('## Projects');
    lines.push('');
    for (const project of inventory.projects) {
      lines.push(`- ${project}`);
    }
    lines.push('');
  }

  lines.push('## Lecture Inventory by Section');
  lines.push('');

  for (const section of inventory.sections) {
    lines.push(`### ${section.title}`);
    lines.push('');
    lines.push('| # | Title | Classification | Tech |');
    lines.push('|---|-------|----------------|------|');
    for (const lec of section.lectures) {
      const tech = lec.detectedItems.slice(0, 3).join(', ') || '-';
      lines.push(
        `| ${String(lec.lectureIndex).padStart(3, '0')} | ${lec.title} | ${lec.classification} | ${tech} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function writeInventory(dir: string, inventory: CourseInventory, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const jsonPath = path.join(dir, 'course-inventory.json');
  const mdPath = path.join(dir, 'course-inventory.md');

  guardedWrite(jsonPath, JSON.stringify(inventory, null, 2));
  log.info(`Inventory JSON saved: ${jsonPath}`);

  guardedWrite(mdPath, inventoryToMarkdown(inventory));
  log.info(`Inventory markdown saved: ${mdPath}`);
}

export function writeOptimizedPlan(dir: string, plan: StudyPlan, courseTitle: string, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const mdPath = path.join(dir, 'optimized-learning-plan.md');
  guardedWrite(mdPath, studyPlanToMarkdown(plan, courseTitle));
  log.info(`Optimized plan saved: ${mdPath}`);
}

export function writeSelectedPlan(dir: string, plan: StudyPlan, courseTitle: string, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const mdPath = path.join(dir, 'selected-learning-plan.md');
  guardedWrite(mdPath, studyPlanToMarkdown(plan, courseTitle));
  log.info(`Selected plan saved: ${mdPath}`);
}

export function writeBuildFirstPlan(dir: string, plan: StudyPlan, courseTitle: string, logger?: AppLogger): void {
  const log = logger ?? consoleLogger;
  const mdPath = path.join(dir, 'build-first-plan.md');
  guardedWrite(mdPath, buildFirstPlanToMarkdown(plan, courseTitle));
  log.info(`Build-first plan saved: ${mdPath}`);
}
