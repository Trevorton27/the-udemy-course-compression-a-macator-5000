import { useState } from 'react';
import { submitOptimizeJob } from '../api';

interface InventorySection {
  title: string;
  sectionIndex: number;
}

interface CourseInventory {
  courseTitle: string;
  sections: InventorySection[];
  technologies: string[];
}

interface Props {
  transcriptsPath: string;
  inventory: CourseInventory;
  onJobStarted: (jobId: string) => void;
}

export default function CourseInventorySelector({ transcriptsPath, inventory, onJobStarted }: Props) {
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [selectedTechs, setSelectedTechs] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleSection(idx: string) {
    setSelectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleTech(tech: string) {
    setSelectedTechs((prev) => {
      const next = new Set(prev);
      if (next.has(tech)) next.delete(tech);
      else next.add(tech);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const criteria = {
        sections: selectedSections.size > 0 ? Array.from(selectedSections) : undefined,
        technologies: selectedTechs.size > 0 ? Array.from(selectedTechs) : undefined,
        keyword: keyword.trim() || undefined,
      };
      const { jobId } = await submitOptimizeJob(transcriptsPath, 'selected', criteria);
      onJobStarted(jobId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h3 style={{ margin: 0 }}>Select Content for {inventory.courseTitle}</h3>

      <div>
        <h4 style={{ marginBottom: 8 }}>Sections</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {inventory.sections.map((s) => (
            <label key={s.sectionIndex} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedSections.has(String(s.sectionIndex))}
                onChange={() => toggleSection(String(s.sectionIndex))}
                style={{ marginTop: 2 }}
              />
              <span style={{ fontSize: 13 }}>{s.title}</span>
            </label>
          ))}
        </div>
      </div>

      {inventory.technologies.length > 0 && (
        <div>
          <h4 style={{ marginBottom: 8 }}>Technologies</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {inventory.technologies.map((tech) => (
              <label
                key={tech}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  border: `1px solid ${selectedTechs.has(tech) ? '#1a73e8' : '#ccc'}`,
                  borderRadius: 16,
                  cursor: 'pointer',
                  fontSize: 13,
                  background: selectedTechs.has(tech) ? '#e8f0fe' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTechs.has(tech)}
                  onChange={() => toggleTech(tech)}
                  style={{ display: 'none' }}
                />
                {tech}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 style={{ marginBottom: 8 }}>Keyword filter</h4>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="e.g. docker, authentication, testing"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          padding: '10px 24px',
          background: loading ? '#aaa' : '#1a73e8',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        {loading ? 'Generating...' : 'Generate Selected Plan'}
      </button>
    </form>
  );
}
