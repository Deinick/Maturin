import express from 'express';

const app=express();
const PORT=3000;

app.use(express.json());
app.get('/', (_req, res) => {
  res.send('Server is running');
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
