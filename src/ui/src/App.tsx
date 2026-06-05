import { useState, useCallback, useEffect } from 'react';
import AppHeader from './components/AppHeader';
import CourseUrlForm from './components/CourseUrlForm';
import JobView from './components/JobView';
import CourseDashboard from './components/CourseDashboard';
import CourseMapView from './components/CourseMapView';
import LectureSelector from './components/LectureSelector';
import StudyPlanPreview from './components/StudyPlanPreview';
import ErrorRecoveryPanel from './components/ErrorRecoveryPanel';
import CourseLibraryPanel from './components/CourseLibrary';
import { submitScrapeJob, submitOptimizeJob, getJob } from './api';
import { useJobProgress } from './hooks/useJobProgress';
import type {
  DashboardData,
  CourseInventory,
  LectureResult,
  CourseLibraryEntry,
} from './types';

type View = 'home' | 'job' | 'dashboard' | 'course-map' | 'study-plan' | 'selector' | 'library';

interface JobState {
  id: string;
  status: 'pending' | 'running' | 'waiting-for-login' | 'complete' | 'failed';
  outputFiles: string[];
  mode: string;
}

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [view, setView] = useState<View>('home');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<JobState | null>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardOutputFiles, setDashboardOutputFiles] = useState<string[]>([]);
  const [errorFilePath, setErrorFilePath] = useState('');
  const [transcriptsPath, setTranscriptsPath] = useState('');

  // Course map state
  const [courseMapInventory, setCourseMapInventory] = useState<CourseInventory | null>(null);
  const [transcriptStatus, setTranscriptStatus] = useState<Map<number, 'ok' | 'skipped' | 'error'>>(new Map());

  // Selector state
  const [selectorInventory, setSelectorInventory] = useState<CourseInventory | null>(null);
  const [selectorTranscriptsPath, setSelectorTranscriptsPath] = useState('');

  // Study plan state
  const [studyPlanPaths, setStudyPlanPaths] = useState<string[]>([]);
  const [studyPlanCourseTitle, setStudyPlanCourseTitle] = useState('');

  // Progress timeline (second EventSource to same endpoint)
  const progress = useJobProgress(job?.id ?? null);

  // Apply dark mode CSS variables
  useEffect(() => {
    const root = document.documentElement;
    const vars = darkMode
      ? {
          '--bg': '#121212', '--surface': '#1e1e1e', '--text': '#e8e8e8',
          '--text-muted': '#999', '--border': '#555', '--accent': '#4d9ef7',
          '--accent-subtle': '#1a3360', '--error-bg': '#3b1a1a',
          '--error-border': '#8b3535', '--error-text': '#ff8a8a',
          '--section-border': '#333', '--input-bg': '#2a2a2a',
        }
      : {
          '--bg': '#fff', '--surface': '#fff', '--text': '#222',
          '--text-muted': '#666', '--border': '#ccc', '--accent': '#1a73e8',
          '--accent-subtle': '#e8f0fe', '--error-bg': '#ffebee',
          '--error-border': '#ef9a9a', '--error-text': '#c62828',
          '--section-border': '#e0e0e0', '--input-bg': '#fff',
        };
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    document.body.style.background = darkMode ? '#121212' : '#fff';
    document.body.style.color = darkMode ? '#e8e8e8' : '#222';
  }, [darkMode]);

  async function handleStart(url: string, mode: string) {
    setLoading(true);
    setError('');
    try {
      const { jobId } = await submitScrapeJob(url, mode);
      setJob({ id: jobId, status: 'pending', outputFiles: [], mode });
      setView('job');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadDashboard(files: string[]) {
    const inventoryFile = files.find((f) => f.endsWith('course-inventory.json'));
    const transcriptsFile = files.find((f) => f.endsWith('transcripts.json'));
    if (!inventoryFile || !transcriptsFile) return false;

    const [invRes, transRes] = await Promise.all([
      fetch(`/api/files/download?path=${encodeURIComponent(inventoryFile)}`),
      fetch(`/api/files/download?path=${encodeURIComponent(transcriptsFile)}`),
    ]);

    if (!invRes.ok || !transRes.ok) return false;

    const inventory = await invRes.json() as CourseInventory;
    const results = await transRes.json() as LectureResult[];

    const tCount = results.filter((r) => !r.skipped && !r.error && r.rows.length > 0).length;
    const sCount = results.filter((r) => r.skipped).length;
    const fCount = results.filter((r) => !!r.error).length;

    const classificationCounts = { build: 0, watch: 0, skim: 0, skip: 0 };
    for (const section of inventory.sections) {
      for (const lec of section.lectures) {
        if (lec.classification in classificationCounts) {
          classificationCounts[lec.classification]++;
        }
      }
    }

    const planPaths = files.filter(
      (f) => f.endsWith('-learning-plan.md') || f.endsWith('-plan.md'),
    );

    const outputDir = inventoryFile.split('/').slice(0, -1).join('/');
    const errFile = files.find((f) => f.endsWith('errors.json')) ?? '';

    setDashboardData({
      courseTitle: inventory.courseTitle,
      totalSections: inventory.sections.length,
      totalLectures: results.length,
      transcriptCount: tCount,
      skippedCount: sCount,
      failedCount: fCount,
      technologies: inventory.technologies,
      classificationCounts,
      outputDir,
      hasErrors: fCount > 0,
      errorCount: fCount,
      availablePlanPaths: planPaths,
    });
    setDashboardOutputFiles(files);
    setTranscriptsPath(transcriptsFile);
    setErrorFilePath(errFile);
    setCourseMapInventory(inventory);

    const statusMap = new Map<number, 'ok' | 'skipped' | 'error'>();
    for (const r of results) {
      if (r.error) statusMap.set(r.lecture.index, 'error');
      else if (r.skipped) statusMap.set(r.lecture.index, 'skipped');
      else statusMap.set(r.lecture.index, 'ok');
    }
    setTranscriptStatus(statusMap);

    return true;
  }

  const handleDone = useCallback(async () => {
    if (!job) return;
    try {
      const snapshot = await getJob(job.id);
      const files = snapshot.outputFiles;
      setJob((prev) => prev ? { ...prev, status: snapshot.status, outputFiles: files } : prev);

      if (snapshot.status === 'complete') {
        const hasInventory = files.some((f) => f.endsWith('course-inventory.json'));
        if (hasInventory) {
          const ok = await loadDashboard(files);
          if (ok) setView('dashboard');
        }
      }
    } catch {
      // best effort
    }
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleLoginConfirmed() {
    setJob((prev) => prev ? { ...prev, status: 'running' } : prev);
  }

  function handleOptimizeJobStarted(jobId: string) {
    setJob({ id: jobId, status: 'pending', outputFiles: [], mode: 'selected' });
    setView('job');
    setSelectorInventory(null);
  }

  function handleRetryStarted(jobId: string) {
    setJob({ id: jobId, status: 'pending', outputFiles: [], mode: 'retry' });
    setDashboardData(null);
    setView('job');
  }

  function handleOpenCourseMap() {
    if (courseMapInventory) setView('course-map');
  }

  function handleOpenStudyPlan() {
    if (dashboardData && dashboardData.availablePlanPaths.length > 0) {
      setStudyPlanPaths(dashboardData.availablePlanPaths);
      setStudyPlanCourseTitle(dashboardData.courseTitle);
      setView('study-plan');
    }
  }

  function handleOpenSelector() {
    if (courseMapInventory && transcriptsPath) {
      setSelectorInventory(courseMapInventory);
      setSelectorTranscriptsPath(transcriptsPath);
      setView('selector');
    }
  }

  async function handleLibraryOpenDashboard(entry: CourseLibraryEntry) {
    const baseFiles = [
      `${entry.id}/course-inventory.json`,
      `${entry.id}/transcripts.json`,
      entry.hasOptimizedPlan ? `${entry.id}/optimized-learning-plan.md` : null,
      entry.hasSelectedPlan ? `${entry.id}/selected-learning-plan.md` : null,
      entry.hasBuildFirstPlan ? `${entry.id}/build-first-plan.md` : null,
      entry.failedCount > 0 ? `${entry.id}/errors.json` : null,
    ].filter(Boolean) as string[];

    const ok = await loadDashboard(baseFiles);
    if (ok) setView('dashboard');
  }

  async function handleLibraryOpenCourseMap(entry: CourseLibraryEntry) {
    const [invRes, transRes] = await Promise.all([
      fetch(`/api/files/download?path=${encodeURIComponent(`${entry.id}/course-inventory.json`)}`),
      fetch(`/api/files/download?path=${encodeURIComponent(`${entry.id}/transcripts.json`)}`),
    ]);
    if (!invRes.ok || !transRes.ok) return;
    const inventory = await invRes.json() as CourseInventory;
    const results = await transRes.json() as LectureResult[];

    const statusMap = new Map<number, 'ok' | 'skipped' | 'error'>();
    for (const r of results) {
      if (r.error) statusMap.set(r.lecture.index, 'error');
      else if (r.skipped) statusMap.set(r.lecture.index, 'skipped');
      else statusMap.set(r.lecture.index, 'ok');
    }

    setCourseMapInventory(inventory);
    setTranscriptStatus(statusMap);
    setTranscriptsPath(`${entry.id}/transcripts.json`);
    setSelectorInventory(inventory);
    setSelectorTranscriptsPath(`${entry.id}/transcripts.json`);
    setView('course-map');
  }

  async function handleLibraryReoptimize(entry: CourseLibraryEntry) {
    try {
      const { jobId } = await submitOptimizeJob(
        `${entry.id}/transcripts.json`,
        'optimize-all',
      );
      setJob({ id: jobId, status: 'pending', outputFiles: [], mode: 'optimize-all' });
      setView('job');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '40px auto',
        padding: '0 20px',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--text)',
      }}
    >
      <AppHeader
        darkMode={darkMode}
        onToggleDark={() => setDarkMode((d) => !d)}
        onGoLibrary={() => setView('library')}
        onGoHome={() => { setView('home'); setJob(null); setDashboardData(null); }}
      />

      {error && (
        <div
          style={{
            background: 'var(--error-bg)',
            border: '1px solid var(--error-border)',
            borderRadius: 4,
            padding: '10px 14px',
            marginBottom: 20,
            color: 'var(--error-text)',
          }}
        >
          {error}
        </div>
      )}

      {view === 'home' && (
        <CourseUrlForm onSubmit={handleStart} loading={loading} />
      )}

      {view === 'job' && job && (
        <JobView
          job={job}
          progress={progress}
          onDone={handleDone}
          onLoginConfirmed={handleLoginConfirmed}
          onNewJob={() => { setView('home'); setJob(null); }}
        />
      )}

      {view === 'dashboard' && dashboardData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <button
              onClick={() => setView('home')}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 4, padding: '4px 12px', cursor: 'pointer', color: 'var(--text)',
              }}
            >
              ← New job
            </button>
          </div>
          <CourseDashboard
            data={dashboardData}
            outputFiles={dashboardOutputFiles}
            onOpenCourseMap={handleOpenCourseMap}
            onOpenStudyPlan={handleOpenStudyPlan}
            onOpenSelector={handleOpenSelector}
            onRetryErrors={() => {}}
          />
          {dashboardData.hasErrors && errorFilePath && (
            <ErrorRecoveryPanel
              errorFilePath={errorFilePath}
              transcriptsPath={transcriptsPath}
              onRetryStarted={handleRetryStarted}
            />
          )}
        </div>
      )}

      {view === 'course-map' && courseMapInventory && (
        <CourseMapView
          inventory={courseMapInventory}
          transcriptStatus={transcriptStatus}
          onBack={() => dashboardData ? setView('dashboard') : setView('home')}
          onOpenSelector={handleOpenSelector}
        />
      )}

      {view === 'selector' && selectorInventory && selectorTranscriptsPath && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => dashboardData ? setView('dashboard') : setView('home')}
              style={{
                background: 'none', border: '1px solid var(--border)',
                borderRadius: 4, padding: '4px 12px', cursor: 'pointer', color: 'var(--text)',
              }}
            >
              ← Back
            </button>
          </div>
          <LectureSelector
            transcriptsPath={selectorTranscriptsPath}
            inventory={selectorInventory}
            onJobStarted={handleOptimizeJobStarted}
          />
        </div>
      )}

      {view === 'study-plan' && (
        <StudyPlanPreview
          planPaths={studyPlanPaths}
          courseTitle={studyPlanCourseTitle}
          onBack={() => dashboardData ? setView('dashboard') : setView('home')}
        />
      )}

      {view === 'library' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Course Library</h2>
          </div>
          <CourseLibraryPanel
            onOpenDashboard={handleLibraryOpenDashboard}
            onOpenCourseMap={handleLibraryOpenCourseMap}
            onReoptimize={handleLibraryReoptimize}
          />
        </div>
      )}
    </div>
  );
}
