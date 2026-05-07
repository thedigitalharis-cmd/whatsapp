"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = require("./middleware/auth");
// Routes
const auth_2 = __importDefault(require("./routes/auth"));
const users_1 = __importDefault(require("./routes/users"));
const organizations_1 = __importDefault(require("./routes/organizations"));
const whatsapp_1 = __importDefault(require("./routes/whatsapp"));
const contacts_1 = __importDefault(require("./routes/contacts"));
const leads_1 = __importDefault(require("./routes/leads"));
const deals_1 = __importDefault(require("./routes/deals"));
const pipelines_1 = __importDefault(require("./routes/pipelines"));
const conversations_1 = __importDefault(require("./routes/conversations"));
const messages_1 = __importDefault(require("./routes/messages"));
const broadcasts_1 = __importDefault(require("./routes/broadcasts"));
const campaigns_1 = __importDefault(require("./routes/campaigns"));
const automations_1 = __importDefault(require("./routes/automations"));
const templates_1 = __importDefault(require("./routes/templates"));
const reports_1 = __importDefault(require("./routes/reports"));
const products_1 = __importDefault(require("./routes/products"));
const orders_1 = __importDefault(require("./routes/orders"));
const tickets_1 = __importDefault(require("./routes/tickets"));
const knowledgeBase_1 = __importDefault(require("./routes/knowledgeBase"));
const integrations_1 = __importDefault(require("./routes/integrations"));
const webhooks_1 = __importDefault(require("./routes/webhooks"));
const tags_1 = __importDefault(require("./routes/tags"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const ai_1 = __importDefault(require("./routes/ai"));
const qrCodes_1 = __importDefault(require("./routes/qrCodes"));
const billing_1 = __importDefault(require("./routes/billing"));
const teams_1 = __importDefault(require("./routes/teams"));
const audit_1 = __importDefault(require("./routes/audit"));
const settings_1 = __importDefault(require("./routes/settings"));
const upload_1 = __importDefault(require("./routes/upload"));
const publicMedia_1 = __importDefault(require("./routes/publicMedia"));
const followUps_1 = __importDefault(require("./routes/followUps"));
const integrations_extended_1 = __importDefault(require("./routes/integrations-extended"));
const followUpService_1 = require("./services/followUpService");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});
exports.io = io;
// Security middleware
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow all origins — handled by nginx in production
        return callback(null, true);
    },
    credentials: true,
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: 'Too many requests from this IP',
});
app.use('/api', limiter);
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// WhatsApp webhook (public)
app.use('/webhook', webhooks_1.default);
// Public media proxy (needed for <audio>/<video> playback without auth headers)
app.use('/media', publicMedia_1.default);
// Auth routes (public)
app.use('/api/auth', auth_2.default);
// Protected routes
app.use('/api/users', auth_1.authMiddleware, users_1.default);
app.use('/api/organizations', auth_1.authMiddleware, organizations_1.default);
app.use('/api/teams', auth_1.authMiddleware, teams_1.default);
app.use('/api/whatsapp', auth_1.authMiddleware, whatsapp_1.default);
app.use('/api/contacts', auth_1.authMiddleware, contacts_1.default);
app.use('/api/leads', auth_1.authMiddleware, leads_1.default);
app.use('/api/deals', auth_1.authMiddleware, deals_1.default);
app.use('/api/pipelines', auth_1.authMiddleware, pipelines_1.default);
app.use('/api/conversations', auth_1.authMiddleware, conversations_1.default);
app.use('/api/messages', auth_1.authMiddleware, messages_1.default);
app.use('/api/broadcasts', auth_1.authMiddleware, broadcasts_1.default);
app.use('/api/campaigns', auth_1.authMiddleware, campaigns_1.default);
app.use('/api/automations', auth_1.authMiddleware, automations_1.default);
app.use('/api/templates', auth_1.authMiddleware, templates_1.default);
app.use('/api/reports', auth_1.authMiddleware, reports_1.default);
app.use('/api/products', auth_1.authMiddleware, products_1.default);
app.use('/api/orders', auth_1.authMiddleware, orders_1.default);
app.use('/api/tickets', auth_1.authMiddleware, tickets_1.default);
app.use('/api/knowledge-base', auth_1.authMiddleware, knowledgeBase_1.default);
app.use('/api/integrations', auth_1.authMiddleware, integrations_1.default);
app.use('/api/tags', auth_1.authMiddleware, tags_1.default);
app.use('/api/analytics', auth_1.authMiddleware, analytics_1.default);
app.use('/api/ai', auth_1.authMiddleware, ai_1.default);
app.use('/api/qr-codes', auth_1.authMiddleware, qrCodes_1.default);
app.use('/api/billing', auth_1.authMiddleware, billing_1.default);
app.use('/api/audit', auth_1.authMiddleware, audit_1.default);
app.use('/api/settings', auth_1.authMiddleware, settings_1.default);
app.use('/api/upload', auth_1.authMiddleware, upload_1.default);
// Serve uploaded files publicly
const path_1 = __importDefault(require("path"));
app.use('/uploads', require('express').static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api/follow-ups', auth_1.authMiddleware, followUps_1.default);
app.use('/api/integrations-extended', auth_1.authMiddleware, integrations_extended_1.default);
// Socket.IO
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token)
        return next(new Error('Authentication error'));
    next();
});
io.on('connection', (socket) => {
    logger_1.logger.info(`Socket connected: ${socket.id}`);
    socket.on('join:organization', (organizationId) => {
        socket.join(`org:${organizationId}`);
    });
    socket.on('join:conversation', (conversationId) => {
        socket.join(`conv:${conversationId}`);
    });
    socket.on('typing:start', (data) => {
        socket.to(`conv:${data.conversationId}`).emit('typing:start', data);
    });
    socket.on('typing:stop', (data) => {
        socket.to(`conv:${data.conversationId}`).emit('typing:stop', data);
    });
    socket.on('disconnect', () => {
        logger_1.logger.info(`Socket disconnected: ${socket.id}`);
    });
});
// Make io accessible globally (for follow-up scheduler and webhook handler)
app.set('io', io);
global.io = io;
app.use(errorHandler_1.errorHandler);
// Start follow-up scheduler
(0, followUpService_1.startFollowUpScheduler)();
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
    logger_1.logger.info(`WhatsApp CRM Backend running on port ${PORT}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map