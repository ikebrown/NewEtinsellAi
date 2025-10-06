
////`services/auth-service/src/middleware/errorHandler.ts```typescript

import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error(error);
  res.status(500).json({
    error: error.message || 'Internal server error',
  });
};
