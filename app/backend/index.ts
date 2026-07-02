import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes      from './routes/authRoutes';
import taskRoutes      from './routes/taskRoutes';
import habitRoutes     from './routes/habitRoutes';
import projectRoutes   from './routes/projectRoutes';
import rolloverRoutes  from './routes/rolloverRoutes';
import statsRoutes     from './routes/statsRoutes';
import suggestionRoutes from './routes/suggestionRoutes';
import inviteRoutes        from './routes/inviteRoutes';
import pendingChangeRoutes from './routes/pendingChangeRoutes';
import { requireAuth } from './middleware/auth';
import { PermissionError } from './services/projectService';
import { InviteError } from './services/inviteService';
import * as inviteController from './controllers/inviteController';

const app  = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:5173';

app.use(helmet());
app.use(cors({
    origin: (origin, cb) => {
        // Allow server-to-server requests (no origin) and the whitelisted frontend
        if (!origin || origin === ALLOWED_ORIGIN) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json());

// Tight rate limit on auth endpoints only — prevents brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts — please try again in 15 minutes' },
});

// Broad limit on all other API calls — prevents scraping/abuse
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests — please slow down' },
});

app.get('/', (_req, res) => { res.send('Server is running'); });

// Public — no token required
app.use('/api/auth', authLimiter, authRoutes);
app.get('/api/invites/:token', inviteController.getInvite);

// All routes below this line require a valid JWT
app.use(apiLimiter);
app.use(requireAuth);
app.use('/api/invites',         inviteRoutes);
app.use('/api/pending-changes', pendingChangeRoutes);
app.use('/api/tasks',       taskRoutes);
app.use('/api/habits',      habitRoutes);
app.use('/api/projects',    projectRoutes);
app.use('/api/rollover',    rolloverRoutes);
app.use('/api/stats',       statsRoutes);
app.use('/api/suggestions', suggestionRoutes);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof PermissionError) {
        res.status(403).json({ error: err.message });
        return;
    }
    if (err instanceof InviteError) {
        res.status(err.status).json({ error: err.message });
        return;
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => { console.log(`Server started on port ${PORT}`); });
