"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const qrcode_1 = __importDefault(require("qrcode"));
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const codes = await database_1.prisma.qRCode.findMany({
            where: { organizationId: req.user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        res.json(codes);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const { name, message, whatsappAccountId, expiresAt } = req.body;
        const account = whatsappAccountId ? await database_1.prisma.whatsAppAccount.findUnique({
            where: { id: whatsappAccountId },
        }) : null;
        const waLink = account
            ? `https://wa.me/${account.phoneNumber.replace('+', '')}?text=${encodeURIComponent(message || '')}`
            : `https://wa.me/?text=${encodeURIComponent(message || '')}`;
        const qrDataUrl = await qrcode_1.default.toDataURL(waLink);
        const qrCode = await database_1.prisma.qRCode.create({
            data: {
                organizationId: req.user.organizationId,
                whatsappAccountId,
                name,
                message,
                imageUrl: qrDataUrl,
                expiresAt: expiresAt ? new Date(expiresAt) : null,
            },
        });
        res.status(201).json(qrCode);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        await database_1.prisma.qRCode.delete({ where: { id: req.params.id } });
        res.json({ message: 'Deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=qrCodes.js.map