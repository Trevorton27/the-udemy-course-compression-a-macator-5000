import type { LectureResult } from '../types.js';
import type {
  CourseInventory,
  ClassifiedLecture,
  StudyPlan,
  SelectionCriteria,
  InventoryLecture,
} from '../types/optimizerTypes.js';

function applySelectionCriteria(
  inventory: CourseInventory,
  classified: ClassifiedLecture[],
  criteria: SelectionCriteria,
): { filteredInventory: CourseInventory; filteredClassified: ClassifiedLecture[] } {
  const allowedSections = criteria.sections ? new Set(criteria.sections) : null;
  const allowedLectures = criteria.lectures ? new Set(criteria.lectures) : null;
  const techFilter = criteria.technologies?.map((t) => t.toLowerCase()) ?? [];
  const keywordFilter = criteria.keywords?.map((k) => k.toLowerCase()) ?? [];
  const projectFilter = criteria.projectNames?.map((p) => p.toLowerCase()) ?? [];

  function lectureMatches(lec: InventoryLecture): boolean {
    if (allowedSections && !allowedSections.has(lec.sectionIndex)) return false;
    if (allowedLectures && !allowedLectures.has(lec.lectureIndex)) return false;
    if (techFilter.length > 0) {
      const hastech = techFilter.some((t) =>
        lec.detectedItems.some((d) => d.includes(t)) || lec.title.toLowerCase().includes(t),
      );
      if (!hastech) return false;
    }
    if (keywordFilter.length > 0) {
      const hasKeyword = keywordFilter.some((k) => lec.title.toLowerCase().includes(k));
      if (!hasKeyword) return false;
    }
    if (projectFilter.length > 0) {
      const hasProject = projectFilter.some((p) => lec.title.toLowerCase().includes(p));
      if (!hasProject) return false;
    }
    return true;
  }

  const filteredSections = inventory.sections
    .map((section) => ({
      ...section,
      lectures: section.lectures.filter(lectureMatches),
    }))
    .filter((section) => section.lectures.length > 0);

  const allowedLectureIndices = new Set(
    filteredSections.flatMap((s) => s.lectures.map((l) => l.lectureIndex)),
  );

  return {
    filteredInventory: { ...inventory, sections: filteredSections },
    filteredClassified: classified.filter((c) =>
      allowedLectureIndices.has(c.lecture.lecture.index),
    ),
  };
}

export function generateStudyPlan(
  inventory: CourseInventory,
  classified: ClassifiedLecture[],
  selection?: SelectionCriteria,
): StudyPlan {
  let activeInventory = inventory;
  let activeClassified = classified;

  if (selection) {
    const filtered = applySelectionCriteria(inventory, classified, selection);
    activeInventory = filtered.filteredInventory;
    activeClassified = filtered.filteredClassified;
  }

  const classifiedByIndex = new Map<number, ClassifiedLecture>();
  for (const c of activeClassified) {
    classifiedByIndex.set(c.lecture.lecture.index, c);
  }

  const watchCarefully: InventoryLecture[] = [];
  const skim: InventoryLecture[] = [];
  const skip: InventoryLecture[] = [];

  for (const section of activeInventory.sections) {
    for (const lec of section.lectures) {
      if (lec.classification === 'watch' || lec.classification === 'build') {
        watchCarefully.push(lec);
      } else if (lec.classification === 'skim') {
        skim.push(lec);
      } else {
        skip.push(lec);
      }
    }
  }

  const buildTasks = activeInventory.handsOnTasks.length > 0
    ? activeInventory.handsOnTasks
    : activeClassified
        .filter((c) => c.classification === 'build')
        .map((c) => c.lecture.lecture.title);

  const watchMins = watchCarefully.length * 30;
  const skimMins = skim.length * 10;
  const totalHours = Math.ceil((watchMins + skimMins) / 60);
  const dailyHours = 2;
  const days = Math.ceil(totalHours / dailyHours);

  const dailyPlan: string[] = [];
  if (days <= 1) {
    dailyPlan.push('Day 1: Complete all watch/build lectures (~1-2 hours)');
  } else {
    const lecturesPerDay = Math.ceil(watchCarefully.length / days);
    for (let d = 1; d <= Math.min(days, 7); d++) {
      const start = (d - 1) * lecturesPerDay;
      const end = Math.min(start + lecturesPerDay, watchCarefully.length);
      const items = watchCarefully.slice(start, end);
      if (items.length === 0) break;
      dailyPlan.push(
        `Day ${d}: ${items.map((l) => l.title).join(', ')} (~${dailyHours}h)`,
      );
    }
    if (days > 7) {
      dailyPlan.push(`... and ${days - 7} more days`);
    }
  }

  const projectWorkflow: string[] = [
    '1. Watch all "build" lectures first to understand project structure',
    '2. Recreate each project from scratch without pausing the video',
    '3. Compare your implementation with the course code',
    '4. Extend each project with one additional feature',
    '5. Document what you built in a personal portfolio',
  ];

  return {
    goal: `Master ${activeInventory.courseTitle} with focus on hands-on practice`,
    watchCarefully,
    skim,
    skip,
    buildTasks,
    technologies: activeInventory.technologies,
    dailyPlan,
    projectWorkflow,
  };
}

export function studyPlanToMarkdown(plan: StudyPlan, courseTitle: string): string {
  const lines: string[] = [];

  lines.push(`# Optimized Learning Plan: ${courseTitle}`);
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(plan.goal);
  lines.push('');

  lines.push('## Study Strategy');
  lines.push('');
  lines.push('| Priority | Count | Action |');
  lines.push('|----------|-------|--------|');
  lines.push(`| Watch/Build | ${plan.watchCarefully.length} | Focus here - high signal content |`);
  lines.push(`| Skim | ${plan.skim.length} | Quick read, skip video |`);
  lines.push(`| Skip | ${plan.skip.length} | No value for skill-building |`);
  lines.push('');

  if (plan.buildTasks.length > 0) {
    lines.push('## Priority Build Tasks');
    lines.push('');
    for (const task of plan.buildTasks) {
      lines.push(`- [ ] ${task}`);
    }
    lines.push('');
  }

  if (plan.technologies.length > 0) {
    lines.push('## Technologies Covered');
    lines.push('');
    lines.push(plan.technologies.map((t) => `\`${t}\``).join(', '));
    lines.push('');
  }

  if (plan.dailyPlan.length > 0) {
    lines.push('## Suggested Daily Schedule');
    lines.push('');
    for (const day of plan.dailyPlan) {
      lines.push(`- ${day}`);
    }
    lines.push('');
  }

  lines.push('## Watch Carefully');
  lines.push('');
  if (plan.watchCarefully.length === 0) {
    lines.push('_None_');
  } else {
    let currentSection = '';
    for (const lec of plan.watchCarefully) {
      if (lec.sectionTitle !== currentSection) {
        currentSection = lec.sectionTitle;
        lines.push(`### ${lec.sectionTitle}`);
        lines.push('');
      }
      const badge = lec.classification === 'build' ? ' [BUILD]' : '';
      lines.push(`- [${String(lec.lectureIndex).padStart(3, '0')}] ${lec.title}${badge}`);
    }
  }
  lines.push('');

  if (plan.skim.length > 0) {
    lines.push('## Skim');
    lines.push('');
    let currentSection = '';
    for (const lec of plan.skim) {
      if (lec.sectionTitle !== currentSection) {
        currentSection = lec.sectionTitle;
        lines.push(`### ${lec.sectionTitle}`);
        lines.push('');
      }
      lines.push(`- [${String(lec.lectureIndex).padStart(3, '0')}] ${lec.title}`);
    }
    lines.push('');
  }

  if (plan.skip.length > 0) {
    lines.push('## Skip');
    lines.push('');
    for (const lec of plan.skip) {
      lines.push(`- [${String(lec.lectureIndex).padStart(3, '0')}] ${lec.title}`);
    }
    lines.push('');
  }

  if (plan.projectWorkflow.length > 0) {
    lines.push('## Project Workflow');
    lines.push('');
    for (const step of plan.projectWorkflow) {
      lines.push(step);
    }
    lines.push('');
  }

  return lines.join('\n');
}
