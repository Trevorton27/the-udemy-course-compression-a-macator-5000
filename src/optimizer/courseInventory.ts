import * as fs from 'fs';
import * as path from 'path';
import type { LectureResult } from '../types.js';
import type { CourseInventory, InventorySection, InventoryLecture } from '../types/optimizerTypes.js';

export function loadTranscriptsJson(filePath: string): LectureResult[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as LectureResult[];
}

export function buildInventory(results: LectureResult[], courseTitle: string): CourseInventory {
  const sectionMap = new Map<number, InventorySection>();

  for (const result of results) {
    const { lecture } = result;
    const { sectionIndex, sectionTitle } = lecture;

    if (!sectionMap.has(sectionIndex)) {
      sectionMap.set(sectionIndex, {
        title: sectionTitle,
        sectionIndex,
        lectures: [],
      });
    }

    const inventoryLecture: InventoryLecture = {
      lectureIndex: lecture.index,
      title: lecture.title,
      url: lecture.url,
      sectionTitle,
      sectionIndex,
      classification: 'watch', // default; overwritten by classifyCourse
      detectedItems: [],
    };

    sectionMap.get(sectionIndex)!.lectures.push(inventoryLecture);
  }

  const sections = Array.from(sectionMap.values()).sort((a, b) => a.sectionIndex - b.sectionIndex);

  return {
    courseTitle,
    sections,
    technologies: [],
    projects: [],
    concepts: [],
    frameworks: [],
    libraries: [],
    handsOnTasks: [],
  };
}

export function deriveCourseTitle(dir: string): string {
  const courseMapPath = path.join(dir, 'course-map.json');
  try {
    const raw = fs.readFileSync(courseMapPath, 'utf-8');
    const courseMap = JSON.parse(raw) as { courseTitle?: string };
    if (courseMap.courseTitle) return courseMap.courseTitle;
  } catch {
    // fall through
  }
  return path.basename(dir);
}
