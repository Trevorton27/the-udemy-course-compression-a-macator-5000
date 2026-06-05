import { Router, type Request, type Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { OUTPUT_ROOT } from '../../storage.js';

export const fileRouter = Router();

fileRouter.get('/download', (req: Request, res: Response) => {
  const relPath = req.query['path'];
  if (typeof relPath !== 'string' || !relPath) {
    res.status(400).json({ error: 'path query parameter is required' });
    return;
  }

  // Guard against path traversal
  const absPath = path.resolve(OUTPUT_ROOT, relPath);
  if (!absPath.startsWith(OUTPUT_ROOT + path.sep) && absPath !== OUTPUT_ROOT) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  if (!fs.existsSync(absPath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(absPath);
});
