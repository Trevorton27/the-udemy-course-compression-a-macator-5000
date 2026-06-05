import type { CourseInventory, ClassifiedLecture, StudyPlan, InventoryLecture } from '../types/optimizerTypes.js';
import { BUILD_SIGNALS, SKIP_SIGNALS } from './contentClassifier.js';
import { studyPlanToMarkdown } from './studyPlanGenerator.js';

const INTRO_PATTERNS = [
  'intro', 'introduction', 'welcome', 'outro', 'bonus', 'congratulations',
  'course update', 'resources', 'subscribe', 'thank you', 'thanks for',
];

function shouldDemote(title: string): boolean {
  const lower = title.toLowerCase();
  return INTRO_PATTERNS.some((p) => lower.includes(p));
}

export function generateBuildFirstPlan(
  inventory: CourseInventory,
  classified: ClassifiedLecture[],
): StudyPlan {
  const classifiedByIndex = new Map<number, ClassifiedLecture>();
  for (const c of classified) {
    classifiedByIndex.set(c.lecture.lecture.index, c);
  }

  const buildLectures: InventoryLecture[] = [];
  const watchLectures: InventoryLecture[] = [];
  const skim: InventoryLecture[] = [];
  const skip: InventoryLecture[] = [];

  for (const section of inventory.sections) {
    for (const lec of section.lectures) {
      if (shouldDemote(lec.title)) {
        skip.push(lec);
        continue;
      }
      if (lec.classification === 'build') {
        buildLectures.push(lec);
      } else if (lec.classification === 'watch') {
        watchLectures.push(lec);
      } else if (lec.classification === 'skim') {
        skim.push(lec);
      } else {
        skip.push(lec);
      }
    }
  }

  // build-first ordering: all build lectures first, then watch
  const watchCarefully: InventoryLecture[] = [...buildLectures, ...watchLectures];

  const buildTasks = inventory.handsOnTasks.length > 0
    ? inventory.handsOnTasks
    : classified.filter((c) => c.classification === 'build').map((c) => c.lecture.lecture.title);

  const watchMins = watchCarefully.length * 30;
  const skimMins = skim.length * 10;
  const totalHours = Math.ceil((watchMins + skimMins) / 60);
  const days = Math.ceil(totalHours / 2);

  const dailyPlan: string[] = [];
  if (days <= 1) {
    dailyPlan.push('Day 1: Complete all build/watch lectures (~1-2 hours)');
  } else {
    const lecturesPerDay = Math.ceil(watchCarefully.length / days);
    for (let d = 1; d <= Math.min(days, 7); d++) {
      const start = (d - 1) * lecturesPerDay;
      const end = Math.min(start + lecturesPerDay, watchCarefully.length);
      const items = watchCarefully.slice(start, end);
      if (items.length === 0) break;
      dailyPlan.push(`Day ${d}: ${items.map((l) => l.title).join(', ')} (~2h)`);
    }
    if (days > 7) dailyPlan.push(`... and ${days - 7} more days`);
  }

  const projectWorkflow: string[] = [
    '1. Build all "build" lectures first — hands-on code-along sessions',
    '2. Then work through "watch carefully" lectures for deeper understanding',
    '3. Recreate each project from scratch without pausing the video',
    '4. Extend each project with one additional feature',
    '5. Document what you built in a personal portfolio',
  ];

  // Reference BUILD_SIGNALS and SKIP_SIGNALS to confirm they're used in scope
  void BUILD_SIGNALS;
  void SKIP_SIGNALS;

  return {
    goal: `Master ${inventory.courseTitle} — build-first approach, hands-on from day one`,
    watchCarefully,
    skim,
    skip,
    buildTasks,
    technologies: inventory.technologies,
    dailyPlan,
    projectWorkflow,
    mode: 'build-first',
  };
}

export function buildFirstPlanToMarkdown(plan: StudyPlan, courseTitle: string): string {
  const header = [
    '> **Build-First Mode**: Build lectures are prioritized before Watch lectures.',
    '> All intro/outro/bonus lectures are moved to Skip.',
    '',
  ].join('\n');
  return header + studyPlanToMarkdown(plan, courseTitle);
}
