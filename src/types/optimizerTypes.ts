export type LectureClassification = 'watch' | 'skim' | 'skip' | 'build';

export interface InventoryLecture {
  lectureIndex: number;
  title: string;
  url: string;
  sectionTitle: string;
  sectionIndex: number;
  classification: LectureClassification;
  detectedItems: string[];
}

export interface InventorySection {
  title: string;
  sectionIndex: number;
  lectures: InventoryLecture[];
}

export interface CourseInventory {
  courseTitle: string;
  sections: InventorySection[];
  technologies: string[];
  projects: string[];
  concepts: string[];
  frameworks: string[];
  libraries: string[];
  handsOnTasks: string[];
}

export interface ClassifiedLecture {
  lecture: import('../types.js').LectureResult;
  classification: LectureClassification;
  confidence: number;
  reasons: string[];
}

export interface StudyPlan {
  goal: string;
  watchCarefully: InventoryLecture[];
  skim: InventoryLecture[];
  skip: InventoryLecture[];
  buildTasks: string[];
  technologies: string[];
  dailyPlan: string[];
  projectWorkflow: string[];
  mode?: 'standard' | 'build-first';
}

export interface FailedLecture {
  lectureIndex: number;
  title: string;
  url: string;
  sectionTitle: string;
  sectionIndex: number;
  error: string;
}

export interface SelectionCriteria {
  sections?: number[];
  lectures?: number[];
  projectNames?: string[];
  technologies?: string[];
  keywords?: string[];
}
