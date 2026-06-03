import type { LectureResult } from '../types.js';
import type {
  CourseInventory,
  ClassifiedLecture,
  LectureClassification,
  InventoryLecture,
} from '../types/optimizerTypes.js';

export const TECHNOLOGY_KEYWORDS: string[] = [
  'python', 'javascript', 'typescript', 'react', 'node', 'nodejs', 'next.js', 'nextjs',
  'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'ansible',
  'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  'graphql', 'rest', 'api', 'fastapi', 'flask', 'django', 'express',
  'git', 'github', 'ci/cd', 'linux', 'bash', 'shell',
  'openai', 'langchain', 'llm', 'gpt', 'claude', 'hugging face', 'pytorch', 'tensorflow',
  'vector', 'embedding', 'rag', 'fine-tuning', 'prompt',
  'html', 'css', 'tailwind', 'sass',
  'java', 'kotlin', 'swift', 'go', 'rust', 'c#', 'dotnet',
];

export const BUILD_SIGNALS: string[] = [
  'build', 'create', 'implement', 'deploy', 'code along', 'hands-on', 'hands on',
  'project', 'exercise', 'practice', 'demo', 'set up', 'setup', 'configure',
  'install', 'write', 'develop', 'make', "let's build", "let's code",
  'from scratch', 'step by step', 'walkthrough', 'tutorial',
];

export const SKIM_SIGNALS: string[] = [
  'overview', 'introduction', 'intro', 'recap', 'summary', 'review',
  'brief', 'quick look', 'what is', 'why use', 'background', 'history',
  'comparison', 'alternatives', 'pros and cons', 'wrap up',
];

export const SKIP_SIGNALS: string[] = [
  'welcome', 'congratulations', 'certificate', 'course update',
  'resources', 'faq', 'q&a', 'bonus', 'discount', 'promo',
  'subscribe', 'like', 'follow', 'thank you', 'thanks for',
];

export const PROJECT_SIGNALS: string[] = [
  'project', 'app', 'application', 'system', 'platform', 'tool',
  'build a', 'create a', 'make a', 'develop a',
];

function textBlob(result: LectureResult): string {
  const titleText = result.lecture.title.toLowerCase();
  const transcriptText = result.rows.map((r) => r.text).join(' ').toLowerCase();
  return `${titleText} ${transcriptText}`;
}

function countMatches(blob: string, keywords: string[]): number {
  return keywords.filter((kw) => blob.includes(kw)).length;
}

function matchedItems(blob: string, keywords: string[]): string[] {
  return keywords.filter((kw) => blob.includes(kw));
}

export function classifyLecture(result: LectureResult): ClassifiedLecture {
  if (result.rows.length === 0) {
    const titleBlob = result.lecture.title.toLowerCase();
    const skipMatches = countMatches(titleBlob, SKIP_SIGNALS);
    if (skipMatches > 0 || result.skipped) {
      return {
        lecture: result,
        classification: 'skip',
        confidence: 1.0,
        reasons: ['No transcript available', ...matchedItems(titleBlob, SKIP_SIGNALS)],
      };
    }
    return {
      lecture: result,
      classification: 'skip',
      confidence: 0.8,
      reasons: ['No transcript available'],
    };
  }

  const blob = textBlob(result);
  const buildScore = countMatches(blob, BUILD_SIGNALS);
  const skimScore = countMatches(blob, SKIM_SIGNALS);
  const skipScore = countMatches(blob, SKIP_SIGNALS);
  const reasons: string[] = [];
  let classification: LectureClassification;
  let confidence: number;

  if (skipScore >= 2 && buildScore === 0) {
    classification = 'skip';
    confidence = Math.min(0.5 + skipScore * 0.1, 0.95);
    reasons.push(...matchedItems(blob, SKIP_SIGNALS).map((k) => `skip signal: ${k}`));
  } else if (buildScore >= 2) {
    classification = 'build';
    confidence = Math.min(0.5 + buildScore * 0.1, 0.95);
    reasons.push(...matchedItems(blob, BUILD_SIGNALS).slice(0, 5).map((k) => `build signal: ${k}`));
  } else if (buildScore >= 1) {
    classification = 'watch';
    confidence = 0.7;
    reasons.push(...matchedItems(blob, BUILD_SIGNALS).map((k) => `build signal: ${k}`));
  } else if (skimScore >= 2) {
    classification = 'skim';
    confidence = Math.min(0.5 + skimScore * 0.1, 0.9);
    reasons.push(...matchedItems(blob, SKIM_SIGNALS).slice(0, 5).map((k) => `skim signal: ${k}`));
  } else {
    classification = 'watch';
    confidence = 0.6;
    reasons.push('Default: no strong skip/skim/build signals');
  }

  return { lecture: result, classification, confidence, reasons };
}

export function classifyCourse(
  inventory: CourseInventory,
  results: LectureResult[],
): ClassifiedLecture[] {
  const classifiedAll: ClassifiedLecture[] = results.map((r) => classifyLecture(r));

  const classifiedByIndex = new Map<number, ClassifiedLecture>();
  for (const c of classifiedAll) {
    classifiedByIndex.set(c.lecture.lecture.index, c);
  }

  const techSet = new Set<string>();
  const projectSet = new Set<string>();
  const handsOnSet = new Set<string>();

  for (const result of results) {
    const blob = textBlob(result);
    for (const tech of TECHNOLOGY_KEYWORDS) {
      if (blob.includes(tech)) techSet.add(tech);
    }
    const projectMatches = matchedItems(blob, PROJECT_SIGNALS);
    if (projectMatches.length > 0) {
      projectSet.add(result.lecture.title);
    }
  }

  inventory.technologies = Array.from(techSet).sort();

  inventory.projects = Array.from(projectSet)
    .filter((title) => {
      const classified = results.find((r) => r.lecture.title === title);
      if (!classified) return false;
      const c = classifiedByIndex.get(classified.lecture.index);
      return c && (c.classification === 'build' || c.classification === 'watch');
    })
    .slice(0, 20);

  for (const c of classifiedAll) {
    if (c.classification === 'build') {
      handsOnSet.add(c.lecture.lecture.title);
    }
  }
  inventory.handsOnTasks = Array.from(handsOnSet);

  for (const section of inventory.sections) {
    for (const invLecture of section.lectures) {
      const c = classifiedByIndex.get(invLecture.lectureIndex);
      if (c) {
        invLecture.classification = c.classification;
        invLecture.detectedItems = matchedItems(
          textBlob(c.lecture),
          TECHNOLOGY_KEYWORDS,
        ).slice(0, 10);
      }
    }
  }

  return classifiedAll;
}

export function getInventoryLecture(inventory: CourseInventory, lectureIndex: number): InventoryLecture | undefined {
  for (const section of inventory.sections) {
    const found = section.lectures.find((l) => l.lectureIndex === lectureIndex);
    if (found) return found;
  }
  return undefined;
}
