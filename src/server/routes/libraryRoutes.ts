import { Router, type Request, type Response } from 'express';
import { loadCourseLibrary, deleteLibraryEntry } from '../../storage/courseLibrary.js';

export const libraryRouter = Router();

libraryRouter.get('/', (_req: Request, res: Response) => {
  const library = loadCourseLibrary();
  const sorted = [...library.entries].sort(
    (a, b) => new Date(b.lastRunDate).getTime() - new Date(a.lastRunDate).getTime(),
  );
  res.json({ entries: sorted });
});

libraryRouter.delete('/:courseId', (req: Request, res: Response) => {
  const courseId = decodeURIComponent(String(req.params['courseId'] ?? ''));
  if (!courseId) {
    res.status(400).json({ error: 'courseId is required' });
    return;
  }
  const deleted = deleteLibraryEntry(courseId);
  if (deleted) {
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'Entry not found' });
  }
});
