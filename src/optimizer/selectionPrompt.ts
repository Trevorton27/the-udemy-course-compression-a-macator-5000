import * as readline from 'readline';
import type { LectureResult } from '../types.js';
import type { CourseInventory, SelectionCriteria } from '../types/optimizerTypes.js';

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function promptForSelection(inventory: CourseInventory): Promise<SelectionCriteria> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log('\n=== Course Sections ===\n');
    for (const section of inventory.sections) {
      console.log(`  [${section.sectionIndex}] ${section.title} (${section.lectures.length} lectures)`);
    }
    console.log('');

    if (inventory.technologies.length > 0) {
      console.log('=== Detected Technologies ===\n');
      console.log(' ', inventory.technologies.join(', '));
      console.log('');
    }

    const sectionsInput = await ask(
      rl,
      'Enter section indices to include (comma-separated, or press Enter for all): ',
    );
    const techInput = await ask(
      rl,
      'Filter by technology (comma-separated, or press Enter to skip): ',
    );
    const keywordsInput = await ask(
      rl,
      'Filter by keywords in lecture title (comma-separated, or press Enter to skip): ',
    );

    const criteria: SelectionCriteria = {};

    if (sectionsInput.trim()) {
      criteria.sections = sectionsInput
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }

    if (techInput.trim()) {
      criteria.technologies = techInput.split(',').map((t) => t.trim()).filter(Boolean);
    }

    if (keywordsInput.trim()) {
      criteria.keywords = keywordsInput.split(',').map((k) => k.trim()).filter(Boolean);
    }

    return criteria;
  } finally {
    rl.close();
  }
}

export function filterTranscripts(
  results: LectureResult[],
  criteria: SelectionCriteria,
): LectureResult[] {
  return results.filter((r) => {
    const { lecture } = r;

    if (criteria.sections && !criteria.sections.includes(lecture.sectionIndex)) {
      return false;
    }
    if (criteria.lectures && !criteria.lectures.includes(lecture.index)) {
      return false;
    }
    if (criteria.keywords) {
      const title = lecture.title.toLowerCase();
      const hasKeyword = criteria.keywords.some((k) => title.includes(k.toLowerCase()));
      if (!hasKeyword) return false;
    }

    return true;
  });
}
