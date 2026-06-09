// UI-facing types (mirrored from server types for frontend use)

export interface FailedLecture {
  lectureIndex: number;
  title: string;
  url: string;
  sectionTitle: string;
  sectionIndex: number;
  error: string;
}

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
  hasAiPlan: boolean;
}

export interface InventoryLecture {
  lectureIndex: number;
  title: string;
  url: string;
  sectionTitle: string;
  sectionIndex: number;
  classification: 'watch' | 'skim' | 'skip' | 'build';
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

export interface LectureResult {
  lecture: {
    index: number;
    sectionTitle: string;
    sectionIndex: number;
    title: string;
    url: string;
  };
  rows: { timestamp: string; text: string }[];
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface DashboardData {
  courseTitle: string;
  totalSections: number;
  totalLectures: number;
  transcriptCount: number;
  skippedCount: number;
  failedCount: number;
  technologies: string[];
  classificationCounts: { build: number; watch: number; skim: number; skip: number };
  outputDir: string;
  hasErrors: boolean;
  errorCount: number;
  availablePlanPaths: string[];
  hasAiPlan: boolean;
  aiPlanPath: string;
}

// ─── AI plan types (mirrored from src/types/aiTypes.ts) ───────────────────────

export interface LectureAnalysis {
  lectureIndex: number;
  title: string;
  concepts: string[];
  codeTopics: string[];
  watchValue: 1 | 2 | 3 | 4 | 5;
  canBeReplaced: string | null;
  summary: string;
}

export interface ConceptNode {
  concept: string;
  dependsOn: string[];
  taughtIn: number[];
}

export interface RedundancyCluster {
  concept: string;
  keepLecture: number;
  skipLectures: number[];
  reason: string;
}

export interface LearningPhase {
  phase: string;
  goal: string;
  lectures: number[];
  activeTasks: string[];
}

export interface ProjectDeliverable {
  title: string;
  description: string;
  requiredConcepts: string[];
  estimatedHours: number;
}

export interface AiCourseSynthesis {
  conceptGraph: ConceptNode[];
  redundancyClusters: RedundancyCluster[];
  compressedPath: LearningPhase[];
  projectDeliverables: ProjectDeliverable[];
  skipList: { lectureIndex: number; reason: string }[];
  totalHoursOriginal: number;
  totalHoursOptimized: number;
  compressionRatio: number;
  executiveSummary: string;
}

export interface AiLearningPlan {
  courseTitle: string;
  generatedAt: string;
  model: string;
  transcriptsHash: string;
  focusPrompt?: string;
  lectureAnalyses: LectureAnalysis[];
  synthesis: AiCourseSynthesis;
}
