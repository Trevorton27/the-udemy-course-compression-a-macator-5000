import type { Lecture, LectureResult, TranscriptRow } from './types.js';

function formatRows(rows: TranscriptRow[]): string {
  if (rows.length === 0) return '_No transcript available._\n';
  return rows.map((r) => `**${r.timestamp}** ${r.text}`).join('\n\n');
}

export function toLectureMarkdown(result: LectureResult): string {
  const { lecture, rows, skipped, skipReason, error } = result;
  const lines: string[] = [];

  lines.push(`# [${lecture.index}] ${lecture.title}`);
  lines.push('');
  lines.push(`**Section:** ${lecture.sectionTitle}`);
  lines.push(`**URL:** ${lecture.url}`);
  lines.push('');

  if (error) {
    lines.push(`> **Error:** ${error}`);
    lines.push('');
  } else if (skipped) {
    lines.push(`> **Skipped:** ${skipReason ?? 'No transcript found.'}`);
    lines.push('');
  } else {
    lines.push('## Transcript');
    lines.push('');
    lines.push(formatRows(rows));
  }

  return lines.join('\n');
}

export function toCombinedMarkdown(courseTitle: string, results: LectureResult[]): string {
  const header = `# ${courseTitle} — Full Transcript\n\nGenerated: ${new Date().toISOString()}\n\n---\n\n`;
  const body = results
    .map((r) => toLectureMarkdown(r))
    .join('\n\n---\n\n');
  return header + body;
}

export function toJSON(results: LectureResult[]): object {
  return results.map((r) => ({
    index: r.lecture.index,
    sectionIndex: r.lecture.sectionIndex,
    sectionTitle: r.lecture.sectionTitle,
    title: r.lecture.title,
    url: r.lecture.url,
    skipped: r.skipped,
    skipReason: r.skipReason,
    error: r.error,
    rows: r.rows,
  }));
}
