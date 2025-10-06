
import express from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'media-service' });
});

// Upload photo
app.post('/api/v1/media/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Optimize image
    const optimizedBuffer = await sharp(req.file.buffer)
      .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const fileName = `${uuidv4()}.jpg`;
    const key = `photos/${fileName}`;

    // Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: optimizedBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      })
    );

    const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    // Generate thumbnail
    const thumbnailBuffer = await sharp(req.file.buffer)
      .resize(300, 400, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const thumbnailKey = `thumbnails/${fileName}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: thumbnailKey,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      })
    );

    const thumbnailUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${thumbnailKey}`;

    res.json({
      url,
      thumbnailUrl,
      fileName,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get presigned URL for direct upload
app.post('/api/v1/media/presigned-url', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    const key = `uploads/${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      ContentType: fileType,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({
      uploadUrl: signedUrl,
      key,
      url: `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.MEDIA_SERVICE_PORT || 3007;
app.listen(PORT, () => {
  console.log(`🖼️  Media Service running on port ${PORT}`);
});