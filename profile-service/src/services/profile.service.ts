////services/profile-service/src/services/profile.service.ts``typescript


import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class ProfileService {
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: {
          where: { moderationStatus: 'APPROVED' },
          orderBy: { isMain: 'desc' },
        },
        preferences: true,
        videoProfile: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: any) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        bio: data.bio,
        location: data.location,
      },
      include: {
        photos: true,
        preferences: true,
      },
    });

    return user;
  }

  async uploadPhoto(userId: string, url: string, isMain: boolean = false) {
    // If this is the main photo, set all others to false
    if (isMain) {
      await prisma.photo.updateMany({
        where: { userId },
        data: { isMain: false },
      });
    }

    const photo = await prisma.photo.create({
      data: {
        userId,
        url,
        isMain,
        moderationStatus: 'PENDING',
      },
    });

    return photo;
  }

  async deletePhoto(photoId: string) {
    await prisma.photo.delete({
      where: { id: photoId },
    });
  }

  async updatePreferences(userId: string, preferences: any) {
    const pref = await prisma.preference.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences,
      },
    });

    return pref;
  }
}