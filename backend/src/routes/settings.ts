import { Router, Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest, requireRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';

const router = Router();

// Get current AI + SMTP + integration settings (masked)
router.get('/ai', async (req: AuthRequest, res: Response) => {
  res.json({
    openaiEnabled: !!process.env.OPENAI_API_KEY,
    openaiKeyPreview: process.env.OPENAI_API_KEY
      ? '••••••••' + process.env.OPENAI_API_KEY.slice(-4)
      : null,
    aiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  });
});

// Save OpenAI key — writes to .env and sets process.env immediately
router.post('/ai', requireRole('ADMIN', 'SUPER_ADMIN'), async (req: AuthRequest, res: Response) => {
  try {
    const { openaiApiKey, aiModel } = req.body;

    if (openaiApiKey) {
      process.env.OPENAI_API_KEY = openaiApiKey;
      if (aiModel) process.env.OPENAI_MODEL = aiModel;

      // Persist to .env file
      const envPath = path.join(process.cwd(), '.env');
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        if (content.includes('OPENAI_API_KEY=')) {
          content = content.replace(/OPENAI_API_KEY=.*/, `OPENAI_API_KEY="${openaiApiKey}"`);
        } else {
          content += `\nOPENAI_API_KEY="${openaiApiKey}"`;
        }
        fs.writeFileSync(envPath, content);
      }
    }

    res.json({
      success: true,
      openaiEnabled: !!process.env.OPENAI_API_KEY,
      openaiKeyPreview: process.env.OPENAI_API_KEY
        ? '••••••••' + process.env.OPENAI_API_KEY.slice(-4)
        : null,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Test AI key
router.post('/ai/test', async (req: AuthRequest, res: Response) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'No OpenAI key configured' });
    }
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "CRM AI connected!" in exactly 3 words.' }],
      max_tokens: 20,
    });
    res.json({ success: true, response: result.choices[0].message.content });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
