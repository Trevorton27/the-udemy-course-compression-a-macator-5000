import express from 'express';
import cors from 'cors';
import { jobRouter } from './routes/jobRoutes.js';
import { fileRouter } from './routes/fileRoutes.js';
import { libraryRouter } from './routes/libraryRoutes.js';
import { retryRouter } from './routes/retryRoutes.js';
import { contentRouter } from './routes/contentRoutes.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

app.use(cors());
app.use(express.json());

app.use('/api/jobs', jobRouter);
app.use('/api/jobs/retry-lectures', retryRouter);
app.use('/api/files', fileRouter);
app.use('/api/files/content', contentRouter);
app.use('/api/library', libraryRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
