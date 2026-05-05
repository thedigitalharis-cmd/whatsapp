"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const router = (0, express_1.Router)();
// Get current AI + SMTP + integration settings (masked)
router.get('/ai', async (req, res) => {
    res.json({
        openaiEnabled: !!process.env.OPENAI_API_KEY,
        openaiKeyPreview: process.env.OPENAI_API_KEY
            ? '••••••••' + process.env.OPENAI_API_KEY.slice(-4)
            : null,
        aiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    });
});
// Save OpenAI key — writes to .env and sets process.env immediately
router.post('/ai', (0, auth_1.requireRole)('ADMIN', 'SUPER_ADMIN'), async (req, res) => {
    try {
        const { openaiApiKey, aiModel } = req.body;
        if (openaiApiKey) {
            process.env.OPENAI_API_KEY = openaiApiKey;
            if (aiModel)
                process.env.OPENAI_MODEL = aiModel;
            // Persist to .env file
            const envPath = path_1.default.join(process.cwd(), '.env');
            if (fs_1.default.existsSync(envPath)) {
                let content = fs_1.default.readFileSync(envPath, 'utf8');
                if (content.includes('OPENAI_API_KEY=')) {
                    content = content.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY="${openaiApiKey}"`);
                }
                else {
                    content += `\nOPENAI_API_KEY="${openaiApiKey}"`;
                }
                fs_1.default.writeFileSync(envPath, content);
            }
        }
        res.json({
            success: true,
            openaiEnabled: !!process.env.OPENAI_API_KEY,
            openaiKeyPreview: process.env.OPENAI_API_KEY
                ? '••••••••' + process.env.OPENAI_API_KEY.slice(-4)
                : null,
        });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Test AI key
router.post('/ai/test', async (req, res) => {
    try {
        if (!process.env.OPENAI_API_KEY) {
            return res.status(400).json({ error: 'No OpenAI key configured' });
        }
        const { default: OpenAI } = await Promise.resolve().then(() => __importStar(require('openai')));
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const result = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Say "CRM AI connected!" in exactly 3 words.' }],
            max_tokens: 20,
        });
        res.json({ success: true, response: result.choices[0].message.content });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map