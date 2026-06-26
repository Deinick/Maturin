import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes      from './routes/authRoutes';
import taskRoutes      from './routes/taskRoutes';
import habitRoutes     from './routes/habitRoutes';
import projectRoutes   from './routes/projectRoutes';
import rolloverRoutes  from './routes/rolloverRoutes';
import statsRoutes     from './routes/statsRoutes';
import suggestionRoutes from './routes/suggestionRoutes';
import { requireAuth } from './middleware/auth';

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => { res.send('Server is running'); });

// Public — no token required
app.use('/api/auth', authRoutes);

// All routes below this line require a valid JWT
app.use(requireAuth);
app.use('/api/tasks',       taskRoutes);
app.use('/api/habits',      habitRoutes);
app.use('/api/projects',    projectRoutes);
app.use('/api/rollover',    rolloverRoutes);
app.use('/api/stats',       statsRoutes);
app.use('/api/suggestions', suggestionRoutes);

app.listen(PORT, () => { console.log(`Server started on port ${PORT}`); });
