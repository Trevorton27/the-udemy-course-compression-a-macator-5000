export interface CourseLibraryEntry {
  id: string;
  courseTitle: string;
  sourceUrl: string;
  outputDir: string;
  lastRunDate: string;
  status: 'complete' | 'failed' | 'partial';
  totalLectures: number;
  transcriptCount: number;
  skippedCount: number;
  failedCount: number;
  hasInventory: boolean;
  hasOptimizedPlan: boolean;
  hasSelectedPlan: boolean;
  hasBuildFirstPlan: boolean;
}

export interface CourseLibrary {
  version: 1;
  entries: CourseLibraryEntry[];
}
