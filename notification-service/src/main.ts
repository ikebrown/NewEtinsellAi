
import express from 'express';
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }),
});

// Email transporter
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'notification-service' });
});

// Send push notification
app.post('/api/v1/notifications/push', async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });

    if (!user?.fcmToken) {
      return res.status(404).json({ error: 'FCM token not found' });
    }

    const message = {
      notification: { title, body },
      data: data || {},
      token: user.fcmToken,
    };

    await admin.messaging().send(message);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send email
app.post('/api/v1/notifications/email', async (req, res) => {
  try {
    const { to, subject, html } = req.body;

    await emailTransporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send SMS
app.post('/api/v1/notifications/sms', async (req, res) => {
  try {
    const { to, message } = req.body;

    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 3006;
app.listen(PORT, () => {
  console.log(`📧 Notification Service running on port ${PORT}`);
});