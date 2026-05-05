"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const logger_1 = require("../utils/logger");
const errorHandler = (err, req, res, next) => {
    logger_1.logger.error(err.message, { stack: err.stack, path: req.path });
    if (err.code === 'P2002') {
        return res.status(409).json({ error: 'Duplicate entry', field: err.meta?.target });
    }
    if (err.code === 'P2025') {
        return res.status(404).json({ error: 'Record not found' });
    }
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map