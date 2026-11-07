
import express from 'express';
import cors from 'cors';
import patientsRoutes from '../modules/patients/patients.routes.js';

const app = express();

app.use(cors({
  origin: 'http://localhost:4200'
}));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    application: 'HHM API'
  });
});

app.use('/api/patients', patientsRoutes);

export default app;
