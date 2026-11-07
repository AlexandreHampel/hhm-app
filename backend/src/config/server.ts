
import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './database.js';

const port = Number(process.env.PORT ?? 3000);

async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(`HHM API running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Failed to start HHM API:', error);
    process.exit(1);
  }
}

void startServer();
