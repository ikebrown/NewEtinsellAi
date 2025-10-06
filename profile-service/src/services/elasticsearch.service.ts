
//ELASTICSEARCH INTEGRATION
////`services/profile-service/src/services/elasticsearch.service.ts`typescript

import { Client } from '@elastic/elasticsearch';
import { PrismaClient } from '@prisma/client';

const client = new Client({
  node: process.env.ELASTICSEARCH_URL,
});

const prisma = new PrismaClient();

export class ElasticsearchService {
  private indexName = 'users';

  async indexUser(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        photos: { where: { moderationStatus: 'APPROVED' }, take: 1 },
        preferences: true,
      },
    });

    if (!user) return;

    await client.index({
      index: this.indexName,
      id: userId,
      document: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        age: this.calculateAge(user.birthDate),
        gender: user.gender,
        location: user.location,
        isPremium: user.isPremium,
        isVerified: user.isVerified,
        photo: user.photos[0]?.url,
      },
    });
  }

  async searchUsers(query: string, filters: any = {}) {
    const must: any[] = [
      {
        multi_match: {
          query,
          fields: ['name^2', 'bio'],
          fuzziness: 'AUTO',
        },
      },
    ];

    if (filters.gender) {
      must.push({ term: { gender: filters.gender } });
    }

    if (filters.minAge || filters.maxAge) {
      must.push({
        range: {
          age: {
            gte: filters.minAge || 18,
            lte: filters.maxAge || 99,
          },
        },
      });
    }

    if (filters.location) {
      must.push({
        geo_distance: {
          distance: `${filters.maxDistance || 50}km`,
          location: filters.location,
        },
      });
    }

    const result = await client.search({
      index: this.indexName,
      body: {
        query: { bool: { must } },
        size: 50,
      },
    });

    return result.hits.hits.map((hit: any) => hit._source);
  }

  async deleteUser(userId: string) {
    await client.delete({
      index: this.indexName,
      id: userId,
    });
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }

  async createIndex() {
    const exists = await client.indices.exists({ index: this.indexName });
    
    if (!exists) {
      await client.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: { type: 'text' },
              bio: { type: 'text' },
              age: { type: 'integer' },
              gender: { type: 'keyword' },
              location: { type: 'geo_point' },
              isPremium: { type: 'boolean' },
              isVerified: { type: 'boolean' },
              photo: { type: 'keyword' },
            },
          },
        },
      });
    }
  }
}