import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB, dbReady } from './config/db.js';
import { requireDB } from './middleware/requireDB.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
import itemsRouter from './routes/items.js';

const app = express();
const port = process.env.PORT ?? 5174;

app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: dbReady() ? 'connected' : 'disconnected', time: new Date().toISOString() });
});

// Mount one router per resource here
app.use('/api/items', requireDB, itemsRouter);

app.use(notFound);
app.use(errorHandler);

app.listen(port, () => console.log(`[api] listening on http://localhost:${port}`));
connectDB(); // non-blocking: the API is usable immediately, data routes 503 until connected
