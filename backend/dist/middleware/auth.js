"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../config/database");
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token)
            return res.status(401).json({ error: 'No token provided' });
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await database_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, organizationId: true, role: true, email: true, isActive: true },
        });
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'Invalid or inactive user' });
        }
        req.user = { id: user.id, organizationId: user.organizationId, role: user.role, email: user.email };
        next();
    }
    catch (error) {
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authMiddleware = authMiddleware;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ error: 'Unauthorized' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map