///services/auth-service/src/main.ts` ```typescript


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-service' });
});

// Routes
app.use('/api/v1/auth', authRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🔐 Auth Service running on port ${PORT}`);
});
