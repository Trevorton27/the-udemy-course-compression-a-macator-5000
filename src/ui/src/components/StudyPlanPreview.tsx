import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { getFileContent } from '../api';

interface Props {
  planPaths: string[];
  courseTitle: string;
  onBack: () => void;
}

function planLabel(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath;
  return name
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const markdownComponents: Components = {
  table: ({ children }) => (
    <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 16 }}>{children}</table>
  ),
  th: ({ children }) => (
    <th
      style={{
        padding: '6px 10px',
        borderBottom: '2px solid var(--border)',
        textAlign: 'left',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: '5px 10px',
        borderBottom: '1px solid var(--section-border)',
        fontSize: 13,
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  ),
  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <code
          style={{
            display: 'block',
            background: '#1e1e1e',
            color: '#ccc',
            padding: '12px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'monospace',
            overflowX: 'auto',
            whiteSpace: 'pre',
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          background: 'var(--accent-subtle)',
          color: 'var(--accent)',
          padding: '1px 5px',
          borderRadius: 3,
          fontSize: '0.9em',
          fontFamily: 'monospace',
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre style={{ margin: '0 0 16px', borderRadius: 6, overflow: 'hidden' }}>{children}</pre>
  ),
};

const CLAUDE_PROMPT_PREFIX =
  'Using the course analysis below, help me execute this learning plan by creating daily build tasks, checkpoints, and portfolio deliverables.\n\n';

export default function StudyPlanPreview({ planPaths, courseTitle, onBack }: Props) {
  const [activePath, setActivePath] = useState(planPaths[0] ?? '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (!activePath) return;
    setLoading(true);
    setContent('');
    getFileContent(activePath)
      .then(setContent)
      .catch((err: unknown) => setContent(`Error loading plan: ${String(err)}`))
      .finally(() => setLoading(false));
  }, [activePath]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch {
      setCopySuccess('Failed');
    }
  }

  function handleDownload() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activePath.split('/').pop() ?? 'plan.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleExportClaude() {
    const text = CLAUDE_PROMPT_PREFIX + content;
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess('Claude prompt copied!');
      setTimeout(() => setCopySuccess(''), 2000);
    } catch {
      setCopySuccess('Failed');
    }
  }

  function handleExportNotion() {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notion-${activePath.split('/').pop() ?? 'plan.md'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, padding: '4px 12px', cursor: 'pointer', color: 'var(--text)',
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: 20 }}>Study Plan — {courseTitle}</h2>
      </div>

      {/* Tab bar */}
      {planPaths.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {planPaths.map((p) => (
            <button
              key={p}
              onClick={() => setActivePath(p)}
              style={{
                padding: '7px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, color: activePath === p ? 'var(--accent)' : 'var(--text-muted)',
                borderBottom: `2px solid ${activePath === p ? 'var(--accent)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {planLabel(p)}
            </button>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={handleCopy}
          style={{
            padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)',
          }}
        >
          {copySuccess || 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          style={{
            padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)',
          }}
        >
          Download .md
        </button>
        <button
          onClick={handleExportClaude}
          style={{
            padding: '6px 14px', background: 'var(--accent)', border: 'none',
            borderRadius: 4, fontSize: 13, cursor: 'pointer', color: '#fff',
          }}
        >
          Export Claude Prompt
        </button>
        <button
          onClick={handleExportNotion}
          style={{
            padding: '6px 14px', background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, fontSize: 13, cursor: 'pointer', color: 'var(--text)',
          }}
        >
          Export Notion Markdown
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      ) : (
        <div
          style={{
            border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px',
            background: 'var(--surface)', lineHeight: 1.6,
          }}
        >
          <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
