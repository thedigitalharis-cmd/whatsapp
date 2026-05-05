"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
exports.prisma = global.prisma || new client_1.PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
if (process.env.NODE_ENV !== 'production') {
    global.prisma = exports.prisma;
}
exports.prisma.$connect()
    .then(() => logger_1.logger.info('Database connected'))
    .catch((err) => logger_1.logger.error('Database connection failed', err));
exports.default = exports.prisma;
//# sourceMappingURL=database.js.map