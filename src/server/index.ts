import express from 'express';
import cors from 'cors';
import { jobRouter } from './routes/jobRoutes.js';
import { fileRouter } from './routes/fileRoutes.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);

app.use(cors());
app.use(express.json());

app.use('/api/jobs', jobRouter);
app.use('/api/files', fileRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
