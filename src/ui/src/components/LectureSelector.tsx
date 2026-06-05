import { useState } from 'react';
import type { CourseInventory } from '../types';
import LectureBadge from './LectureBadge';
import { submitOptimizeJob } from '../api';

interface Props {
  transcriptsPath: string;
  inventory: CourseInventory;
  onJobStarted: (jobId: string) => void;
}

export default function LectureSelector({ transcriptsPath, inventory, onJobStarted }: Props) {
  const [selectedLectures, setSelectedLectures] = useState<Set<number>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [filterTech, setFilterTech] = useState<string | null>(null);
  const [buildOnly, setBuildOnly] = useState(false);
  const [hideIntro, setHideIntro] = useState(false);
  const [loading, setLoading] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const kwLower = keyword.toLowerCase();

  function lectureVisible(lec: CourseInventory['sections'][number]['lectures'][number]): boolean {
    if (buildOnly && lec.classification !== 'build') return false;
    if (hideIntro) {
      const t = lec.title.toLowerCase();
      if (t.includes('intro') || t.includes('welcome') || t.includes('outro') || t.includes('bonus')) return false;
    }
    if (filterTech && !lec.detectedItems.includes(filterTech) && !lec.title.toLowerCase().includes(filterTech)) return false;
    if (kwLower && !lec.title.toLowerCase().includes(kwLower)) return false;
    return true;
  }

  const visibleSections = inventory.sections.map((section) => ({
    ...section,
    lectures: section.lectures.filter(lectureVisible),
  })).filter((s) => s.lectures.length > 0);

  function toggleLecture(idx: number) {
    setSelectedLectures((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function toggleSection(sectionLectures: number[]) {
    const allSelected = sectionLectures.every((idx) => selectedLectures.has(idx));
    setSelectedLectures((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const idx of sectionLectures) next.delete(idx);
      } else {
        for (const idx of sectionLectures) next.add(idx);
      }
      return next;
    });
  }

  function toggleCollapse(sectionIndex: number) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionIndex)) next.delete(sectionIndex); else next.add(sectionIndex);
      return next;
    });
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const { jobId } = await submitOptimizeJob(
        transcriptsPath,
        'selected',
        { lectures: Array.from(selectedLectures).map(String) },
      );
      onJobStarted(jobId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 }}>
      <h3 style={{ margin: 0 }}>Select Lectures — {inventory.courseTitle}</h3>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword filter..."
          style={{
            padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)',
            fontSize: 13, background: 'var(--input-bg)', color: 'var(--text)', width: 180,
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={buildOnly} onChange={(e) => setBuildOnly(e.target.checked)} />
          Build-only
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={hideIntro} onChange={(e) => setHideIntro(e.target.checked)} />
          Hide intro/outro
        </label>
      </div>

      {/* Tech pills */}
      {inventory.technologies.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {inventory.technologies.map((tech) => (
            <button
              key={tech}
              onClick={() => setFilterTech(filterTech === tech ? null : tech)}
              style={{
                padding: '3px 10px', borderRadius: 12, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${filterTech === tech ? 'var(--accent)' : 'var(--border)'}`,
                background: filterTech === tech ? 'var(--accent-subtle)' : 'transparent',
                color: filterTech === tech ? 'var(--accent)' : 'var(--text)',
                fontFamily: 'monospace',
              }}
            >
              {tech}
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      {visibleSections.map((section) => {
        const sectionIndices = section.lectures.map((l) => l.lectureIndex);
        const allSelected = sectionIndices.every((idx) => selectedLectures.has(idx));
        const someSelected = sectionIndices.some((idx) => selectedLectures.has(idx));
        const collapsed = collapsedSections.has(section.sectionIndex);

        return (
          <div key={section.sectionIndex} style={{ border: '1px solid var(--section-border)', borderRadius: 6 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                borderBottom: collapsed ? 'none' : '1px solid var(--section-border)',
                background: 'var(--surface)', borderRadius: collapsed ? 6 : '6px 6px 0 0',
              }}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                onChange={() => toggleSection(sectionIndices)}
              />
              <span
                style={{ fontWeight: 600, fontSize: 14, flex: 1, cursor: 'pointer' }}
                onClick={() => toggleCollapse(section.sectionIndex)}
              >
                {section.title}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {sectionIndices.filter((i) => selectedLectures.has(i)).length}/{section.lectures.length}
              </span>
              <button
                onClick={() => toggleCollapse(section.sectionIndex)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}
              >
                {collapsed ? '▸' : '▾'}
              </button>
            </div>

            {!collapsed && (
              <div>
                {section.lectures.map((lec) => (
                  <label
                    key={lec.lectureIndex}
                    style={{
                      display: 'grid', gridTemplateColumns: 'auto 1fr auto',
                      gap: 10, padding: '7px 14px', alignItems: 'center',
                      borderBottom: '1px solid var(--section-border)', cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLectures.has(lec.lectureIndex)}
                      onChange={() => toggleLecture(lec.lectureIndex)}
                    />
                    <span style={{ fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace', marginRight: 6 }}>
                        {String(lec.lectureIndex).padStart(3, '0')}
                      </span>
                      {lec.title}
                    </span>
                    <LectureBadge classification={lec.classification} size="sm" />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {visibleSections.length === 0 && (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>
          No lectures match your filters.
        </p>
      )}

      {/* Sticky bottom bar */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          zIndex: 100,
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>
          {selectedLectures.size} lecture{selectedLectures.size !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={handleSubmit}
          disabled={loading || selectedLectures.size === 0}
          style={{
            padding: '10px 24px',
            background: loading || selectedLectures.size === 0 ? '#aaa' : 'var(--accent)',
            color: '#fff', border: 'none', borderRadius: 4, fontSize: 14,
            cursor: loading || selectedLectures.size === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 500,
          }}
        >
          {loading ? 'Generating...' : 'Generate Selected Plan'}
        </button>
      </div>
    </div>
  );
}
