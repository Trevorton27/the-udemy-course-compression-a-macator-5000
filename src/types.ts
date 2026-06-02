// SELECTOR ASSUMPTION — verify all selectors in DevTools if this breaks.
// Udemy updates their DOM frequently. Update the SELECTORS object below first.

export interface Lecture {
  index: number;
  sectionTitle: string;
  sectionIndex: number;
  title: string;
  url: string;
}

export interface TranscriptRow {
  timestamp: string;
  text: string;
}

export interface LectureResult {
  lecture: Lecture;
  rows: TranscriptRow[];
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface CourseMap {
  courseTitle: string;
  courseUrl: string;
  extractedAt: string;
  lectures: Lecture[];
}

/**
 * Central selector registry. Update here first when Udemy's DOM changes.
 * Each entry documents its purpose and fallback strategy.
 */
export const SELECTORS = {
  // Logged-in indicator in the top nav
  loggedInIndicator: [
    '[data-purpose="header-user-display"]',
    '[class*="header--user-avatar"]',
    'button[class*="user-profile"]',
  ],

  // "Expand all sections" button in curriculum
  expandAll: [
    '[data-purpose="expand-toggle"]',
    'button[class*="curriculum--expand-toggle"]',
    // text fallback handled in code via getByText
  ],

  // Section heading panels in curriculum sidebar
  sectionPanel: [
    '[data-purpose="section-panel"]',
    '[class*="curriculum-section--section-heading"]',
    'div[class*="section--section-heading"]',
  ],

  // Curriculum item links (lectures)
  lectureLink: [
    '[data-purpose="curriculum-item-link"]',
    'a[class*="curriculum-item-link"]',
    '[class*="lecture-link"]',
  ],

  // Transcript toggle button in video player controls
  transcriptToggle: [
    '[data-purpose="transcript-toggle"]',
    'button[class*="transcript-toggle"]',
    // aria-label fallback handled in code via getByLabel
  ],

  // Transcript panel container
  transcriptPanel: [
    '[data-purpose="transcript-panel"]',
    '[class*="transcript--transcript-panel"]',
    '[class*="captions-display--captions-container"]',
  ],

  // Individual transcript cue rows
  transcriptCue: [
    '[data-purpose="transcript-cue"]',
    '[class*="transcript--cue-row"]',
    '[class*="transcript-cue"]',
    '.transcript--cue--',
  ],

  // Timestamp within a cue row
  transcriptTimestamp: [
    '[data-purpose="transcript-cue-timestamp"]',
    '[class*="transcript--cue-row--timestamp"]',
    '[class*="cue-timestamp"]',
  ],

  // Text within a cue row
  transcriptText: [
    '[data-purpose="transcript-cue-text"]',
    '[class*="transcript--cue-row--text"]',
    '[class*="cue-text"]',
  ],

  // Course title in player page
  courseTitle: [
    '[data-purpose="course-title"]',
    'h1[class*="course-title"]',
    '.ud-heading-xl',
  ],
} as const;
