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

export interface SkipEntry {
  lectureIndex: number;
  reason: string;
}

export interface AiCourseSynthesis {
  conceptGraph: ConceptNode[];
  redundancyClusters: RedundancyCluster[];
  compressedPath: LearningPhase[];
  projectDeliverables: ProjectDeliverable[];
  skipList: SkipEntry[];
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
