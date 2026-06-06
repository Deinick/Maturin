import 'dotenv/config';
import express from 'express';
import taskRoutes from './routes/taskRoutes';
import habitRoutes from './routes/habitRoutes';


const app=express();
const PORT=process.env.PORT || 3001;

app.use(express.json());
app.use('/api/tasks', taskRoutes);
app.use('/api/habits', habitRoutes);

app.get('/', (_req, res) => {
  res.send('Server is running');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
