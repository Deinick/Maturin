import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import taskRoutes from './routes/taskRoutes';

const app=express();
const PORT=process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/tasks', taskRoutes);

app.get('/', (_req, res) => {
  res.send('Planner API running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});