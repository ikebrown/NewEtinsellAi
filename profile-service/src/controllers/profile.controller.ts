////`services/profile-service/src/controllers/profile.controller.ts`typescript


import { Request, Response, NextFunction } from 'express';
import { ProfileService } from '../services/profile.service';

export class ProfileController {
  private profileService: ProfileService;

  constructor() {
    this.profileService = new ProfileService();
  }

  getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const profile = await this.profileService.getProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user;
      const profile = await this.profileService.updateProfile(userId, req.body);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  uploadPhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.user;
      const { url, isMain } = req.body;
      const photo = await this.profileService.uploadPhoto(userId, url, isMain);
      res.json(photo);
    } catch (error) {
      next(error);
    }
  };

  deletePhoto = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { photoId } = req.params;
      await this.profileService.deletePhoto(photoId);
      res.json({ message: 'Photo deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
