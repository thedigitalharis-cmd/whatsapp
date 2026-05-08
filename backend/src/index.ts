import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import rateLimit from 'express-rate-limit';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

// Routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import organizationRoutes from './routes/organizations';
import whatsappRoutes from './routes/whatsapp';
import contactRoutes from './routes/contacts';
import leadRoutes from './routes/leads';
import dealRoutes from './routes/deals';
import pipelineRoutes from './routes/pipelines';
import conversationRoutes from './routes/conversations';
import messageRoutes from './routes/messages';
import broadcastRoutes from './routes/broadcasts';
import campaignRoutes from './routes/campaigns';
import automationRoutes from './routes/automations';
import templateRoutes from './routes/templates';
import reportRoutes from './routes/reports';
import productRoutes from './routes/products';
import orderRoutes from './routes/orders';
import ticketRoutes from './routes/tickets';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import integrationRoutes from './routes/integrations';
import webhookRoutes from './routes/webhooks';
import tagRoutes from './routes/tags';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import qrCodeRoutes from './routes/qrCodes';
import billingRoutes from './routes/billing';
import teamRoutes from './routes/teams';
import auditRoutes from './routes/audit';
import settingsRoutes from './routes/settings';
import followUpsRoutes from './routes/followUps';
import integrationsExtendedRoutes from './routes/integrations-extended';
import { startFollowUpScheduler } from './services/followUpService';

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Security middleware
app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.trycloudflare.com')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP',
});
app.use('/api', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WhatsApp webhook (public)
app.use('/webhook', webhookRoutes);

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/organizations', authMiddleware, organizationRoutes);
app.use('/api/teams', authMiddleware, teamRoutes);
app.use('/api/whatsapp', authMiddleware, whatsappRoutes);
app.use('/api/contacts', authMiddleware, contactRoutes);
app.use('/api/leads', authMiddleware, leadRoutes);
app.use('/api/deals', authMiddleware, dealRoutes);
app.use('/api/pipelines', authMiddleware, pipelineRoutes);
app.use('/api/conversations', authMiddleware, conversationRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/broadcasts', authMiddleware, broadcastRoutes);
app.use('/api/campaigns', authMiddleware, campaignRoutes);
app.use('/api/automations', authMiddleware, automationRoutes);
app.use('/api/templates', authMiddleware, templateRoutes);
app.use('/api/reports', authMiddleware, reportRoutes);
app.use('/api/products', authMiddleware, productRoutes);
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/tickets', authMiddleware, ticketRoutes);
app.use('/api/knowledge-base', authMiddleware, knowledgeBaseRoutes);
app.use('/api/integrations', authMiddleware, integrationRoutes);
app.use('/api/tags', authMiddleware, tagRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/ai', authMiddleware, aiRoutes);
app.use('/api/qr-codes', authMiddleware, qrCodeRoutes);
app.use('/api/billing', authMiddleware, billingRoutes);
app.use('/api/audit', authMiddleware, auditRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);
app.use('/api/follow-ups', authMiddleware, followUpsRoutes);
app.use('/api/integrations-extended', authMiddleware, integrationsExtendedRoutes);

// Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  next();
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  socket.on('join:organization', (organizationId: string) => {
    socket.join(`org:${organizationId}`);
  });

  socket.on('join:conversation', (conversationId: string) => {
    socket.join(`conv:${conversationId}`);
  });

  socket.on('typing:start', (data: { conversationId: string; userId: string }) => {
    socket.to(`conv:${data.conversationId}`).emit('typing:start', data);
  });

  socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
    socket.to(`conv:${data.conversationId}`).emit('typing:stop', data);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible globally (for follow-up scheduler and webhook handler)
app.set('io', io);
(global as any).io = io;

app.use(errorHandler);

// Start follow-up scheduler
startFollowUpScheduler();

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`WhatsApp CRM Backend running on port ${PORT}`);
});

export { io };
export default app;
