import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
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
import { sendOverdueTaskReminders } from './services/reminderService';
import * as inviteController from './controllers/inviteController';

const app  = express();
const PORT = process.env.PORT || 3001;

// Render sits behind a reverse proxy; trust its X-Forwarded-For header so
// express-rate-limit and req.ip see the real client IP instead of the proxy's.
app.set('trust proxy', 1);

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
// Raised from the 100kb default so a base64-encoded avatar upload (resized/compressed
// client-side, but still ~30% larger once base64-encoded) fits comfortably.
app.use(express.json({ limit: '3mb' }));

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

// System-triggered only (shared secret, not a user JWT) — lets an external
// scheduler or a manual test call kick off the same digest the cron job below runs.
app.post('/api/internal/send-reminders', async (req, res) => {
    if (!process.env.INTERNAL_CRON_SECRET || req.header('x-internal-secret') !== process.env.INTERNAL_CRON_SECRET)
    {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const result = await sendOverdueTaskReminders();
    res.json(result);
});

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

// Daily overdue-task reminder digest — 8am UTC. Render's free-tier web service
// stays running (unlike serverless), so an in-process schedule is enough here.
cron.schedule('0 8 * * *', () => {
    sendOverdueTaskReminders().catch(err => console.error('[cron] overdue reminders failed:', err));
});

app.listen(PORT, () => { console.log(`Server started on port ${PORT}`); });
