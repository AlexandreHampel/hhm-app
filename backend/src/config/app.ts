
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import peopleRoutes from '../modules/people/people.routes.js';

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

app.use('/api/people', peopleRoutes);

app.use((error: Error & { status?: number; type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({
      message: 'Request body must be valid JSON'
    });
    return;
  }

  const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 500;

  if (status === 500) {
    console.error('Unhandled API error:', error);
  }

  res.status(status).json({
    message: status === 500 ? 'An unexpected error occurred while processing the request' : error.message
  });
});

export default app;
