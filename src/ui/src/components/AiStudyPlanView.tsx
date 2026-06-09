import { useState } from 'react';
import type { AiLearningPlan, LearningPhase, ProjectDeliverable } from '../types';

interface Props {
  plan: AiLearningPlan;
  onBack: () => void;
}

const WATCH_VALUE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Skip', color: 'var(--text-muted)' },
  2: { label: 'Summary', color: '#e65100' },
  3: { label: '2× speed', color: '#1a73e8' },
  4: { label: 'Watch', color: '#1a73e8' },
  5: { label: 'Code-along', color: '#2e7d32' },
};

const CLAUDE_PREFIX =
  'Using the AI-optimized course analysis below, help me execute this learning plan by creating daily build tasks, checkpoints, and portfolio deliverables.\n\n';

function CompressionBanner({ synthesis }: { synthesis: AiLearningPlan['synthesis'] }) {
  const saved = (synthesis.totalHoursOriginal - synthesis.totalHoursOptimized).toFixed(1);
  const pct = synthesis.compressionRatio;
  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--accent-subtle)',
        border: '1px solid var(--accent)',
        borderRadius: 10,
        marginBottom: 24,
        display: 'flex',
        gap: 32,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>{pct}%</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>time saved</div>
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
          {synthesis.totalHoursOriginal}h → {synthesis.totalHoursOptimized}h
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {saved}h eliminated — {synthesis.skipList.length} lectures skipped,{' '}
          {synthesis.redundancyClusters.length} redundancy cluster
          {synthesis.redundancyClusters.length !== 1 ? 's' : ''} removed
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.max(0, 100 - pct)}%`,
              background: 'var(--accent)',
              borderRadius: 4,
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 3, color: 'var(--text-muted)' }}>
          <span>Optimized: {100 - pct}%</span>
          <span>Saved: {pct}%</span>
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, index, lectureMap }: {
  phase: LearningPhase;
  index: number;
  lectureMap: Map<number, string>;
}) {
  const [open, setOpen] = useState(index === 0);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 10 }}>
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span
          style={{
            minWidth: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}
        >
          {index + 1}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{phase.phase}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{phase.goal}</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 14, flexShrink: 0 }}>
          {phase.lectures.length} lectures · {open ? '▾' : '▸'}
        </span>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px' }}>
          {phase.activeTasks.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Tasks
              </div>
              {phase.activeTasks.map((task, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 14 }}>
                  <span style={{ color: 'var(--accent)', marginTop: 1 }}>▶</span>
                  <span>{task}</span>
                </div>
              ))}
            </div>
          )}
          {phase.lectures.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Lectures
              </div>
              {phase.lectures.map((idx) => (
                <div key={idx} style={{ fontSize: 13, color: 'var(--text)', padding: '2px 0' }}>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: 8 }}>
                    {String(idx).padStart(3, '0')}
                  </span>
                  {lectureMap.get(idx) ?? `Lecture ${idx}`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectDeliverable }) {
  return (
    <div
      style={{
        border: '1px solid var(--border)', borderRadius: 8, padding: '16px',
        background: 'var(--surface)',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{project.title}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
        {project.description}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--accent)' }}>~{project.estimatedHours}h</span>
        <span style={{ color: 'var(--text-muted)' }}>
          Requires: {project.requiredConcepts.join(', ')}
        </span>
      </div>
    </div>
  );
}

export default function AiStudyPlanView({ plan, onBack }: Props) {
  const { synthesis } = plan;
  const [showRedundancy, setShowRedundancy] = useState(false);
  const [showSkipList, setShowSkipList] = useState(false);
  const [showConcepts, setShowConcepts] = useState(false);
  const [showLectureTable, setShowLectureTable] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  const lectureMap = new Map<number, string>(
    plan.lectureAnalyses.map((a) => [a.lectureIndex, a.title]),
  );

  async function handleCopy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(''), 2000);
    } catch { /* ignore */ }
  }

  const markdownContent = [
    `# AI-Optimized Learning Plan: ${plan.courseTitle}`,
    '',
    `> ${plan.model} — ${new Date(plan.generatedAt).toLocaleDateString()}`,
    plan.focusPrompt ? `> Focus: ${plan.focusPrompt}` : '',
    '',
    '## Summary',
    '',
    synthesis.executiveSummary,
    '',
    `Compression: ${synthesis.totalHoursOriginal}h → ${synthesis.totalHoursOptimized}h (${synthesis.compressionRatio}% saved)`,
  ].filter((l) => l !== null).join('\n');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border)', borderRadius: 4,
            padding: '4px 12px', cursor: 'pointer', color: 'var(--text)',
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>AI Learning Plan — {plan.courseTitle}</h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {plan.model} · {new Date(plan.generatedAt).toLocaleString()}
            {plan.focusPrompt && ` · Focus: "${plan.focusPrompt}"`}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          onClick={() => handleCopy(markdownContent, copySuccess || 'Copied!')}
          style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}
        >
          {copySuccess || 'Copy Summary'}
        </button>
        <button
          onClick={() => {
            const blob = new Blob([markdownContent], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'ai-learning-plan.md'; a.click();
            URL.revokeObjectURL(url);
          }}
          style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)' }}
        >
          Download .md
        </button>
        <button
          onClick={() => handleCopy(CLAUDE_PREFIX + markdownContent, 'Claude prompt copied!')}
          style={{ padding: '6px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer' }}
        >
          Export Claude Prompt
        </button>
      </div>

      {/* Compression banner */}
      <CompressionBanner synthesis={synthesis} />

      {/* Executive summary */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Strategy
        </div>
        <p style={{ margin: 0, lineHeight: 1.65, fontSize: 14 }}>{synthesis.executiveSummary}</p>
      </div>

      {/* Learning phases */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          Learning Phases
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            {synthesis.compressedPath.length} phases · {synthesis.totalHoursOptimized}h total
          </span>
        </div>
        {synthesis.compressedPath.map((phase, i) => (
          <PhaseCard key={i} phase={phase} index={i} lectureMap={lectureMap} />
        ))}
      </div>

      {/* Projects */}
      {synthesis.projectDeliverables.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
            Portfolio Projects
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {synthesis.projectDeliverables.map((p, i) => (
              <ProjectCard key={i} project={p} />
            ))}
          </div>
        </div>
      )}

      {/* Concept graph */}
      {synthesis.conceptGraph.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowConcepts((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: 0, fontWeight: 600 }}
          >
            {showConcepts ? '▾' : '▸'} Concept Map ({synthesis.conceptGraph.length} concepts)
          </button>
          {showConcepts && (
            <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
              {synthesis.conceptGraph.map((node) => (
                <div key={node.concept} style={{ marginBottom: 8, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{node.concept}</span>
                  {node.dependsOn.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      ← requires: {node.dependsOn.join(', ')}
                    </span>
                  )}
                  {node.taughtIn.length > 0 && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                      · lectures: {node.taughtIn.map((n) => String(n).padStart(3, '0')).join(', ')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Redundancy clusters */}
      {synthesis.redundancyClusters.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowRedundancy((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 14, padding: 0, fontWeight: 600 }}
          >
            {showRedundancy ? '▾' : '▸'} Redundancy Report ({synthesis.redundancyClusters.length} clusters)
          </button>
          {showRedundancy && (
            <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--surface)' }}>
                    {['Concept', 'Keep', 'Skip', 'Reason'].map((h) => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {synthesis.redundancyClusters.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--section-border)' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 500 }}>{c.concept}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: '#2e7d32' }}>{String(c.keepLecture).padStart(3, '0')}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{c.skipLectures.map((n) => String(n).padStart(3, '0')).join(', ')}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{c.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Skip list */}
      {synthesis.skipList.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => setShowSkipList((v) => !v)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0, fontWeight: 600 }}
          >
            {showSkipList ? '▾' : '▸'} Skip List ({synthesis.skipList.length} lectures)
          </button>
          {showSkipList && (
            <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['#', 'Title', 'Reason'].map((h) => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {synthesis.skipList.map((e, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--section-border)', opacity: 0.7 }}>
                      <td style={{ padding: '6px 12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{String(e.lectureIndex).padStart(3, '0')}</td>
                      <td style={{ padding: '6px 12px' }}>{lectureMap.get(e.lectureIndex) ?? `Lecture ${e.lectureIndex}`}</td>
                      <td style={{ padding: '6px 12px', color: 'var(--text-muted)' }}>{e.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Per-lecture analysis table */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowLectureTable((v) => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 0, fontWeight: 600 }}
        >
          {showLectureTable ? '▾' : '▸'} Per-Lecture Analysis ({plan.lectureAnalyses.length} lectures)
        </button>
        {showLectureTable && (
          <div style={{ marginTop: 10, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
                <tr>
                  {['#', 'Title', 'Value', 'Key Concepts', 'Summary'].map((h) => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.lectureAnalyses.map((a) => {
                  const wv = WATCH_VALUE_LABELS[a.watchValue] ?? WATCH_VALUE_LABELS[3]!;
                  return (
                    <tr key={a.lectureIndex} style={{ borderBottom: '1px solid var(--section-border)' }}>
                      <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{String(a.lectureIndex).padStart(3, '0')}</td>
                      <td style={{ padding: '6px 10px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</td>
                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap', color: wv.color, fontWeight: 500 }}>{wv.label}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)', maxWidth: 200 }}>{a.concepts.slice(0, 3).join(', ')}</td>
                      <td style={{ padding: '6px 10px', color: 'var(--text-muted)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.summary}>{a.summary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
