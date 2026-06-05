interface Props {
  files: string[];
}

export default function OutputFilesPanel({ files }: Props) {
  if (files.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Output Files</h3>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {files.map((f) => (
          <li key={f} style={{ margin: '4px 0' }}>
            <a
              href={`/api/files/download?path=${encodeURIComponent(f)}`}
              download
              style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 13 }}
            >
              {f}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
