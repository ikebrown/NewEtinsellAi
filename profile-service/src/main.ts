////typescript

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import profileRoutes from './routes/profile.routes';

dotenv.config();

const app = express();
const PORT = process.env.PROFILE_SERVICE_PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'profile-service' });
});

app.use('/api/v1/profiles', profileRoutes);

app.listen(PORT, () => {
  console.log(`👤 Profile Service running on port ${PORT}`);
});