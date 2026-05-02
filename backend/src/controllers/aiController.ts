import { Response } from 'express';
import { prisma } from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

// Dynamic import for OpenAI to avoid startup failures if key not set
let openai: any = null;
const getOpenAI = async () => {
  if (!openai && process.env.OPENAI_API_KEY) {
    const { default: OpenAI } = await import('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
};

export const generateAIReply = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId, userMessage } = req.body;
    const client = await getOpenAI();
    if (!client) return res.status(503).json({ error: 'AI not configured' });

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, organizationId: req.user!.organizationId },
      include: {
        contact: { select: { firstName: true, lastName: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const messages = conversation.messages.reverse().map(m => ({
      role: m.direction === 'INBOUND' ? 'user' : 'assistant',
      content: m.content || '[media]',
    }));

    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a helpful customer support agent for a business. Be professional, concise, and helpful. 
          Customer name: ${conversation.contact.firstName} ${conversation.contact.lastName || ''}`,
        },
        ...messages,
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error: any) {
    logger.error('AI reply error', error);
    res.status(500).json({ error: error.message });
  }
};

export const summarizeConversation = async (req: AuthRequest, res: Response) => {
  try {
    const client = await getOpenAI();
    if (!client) return res.status(503).json({ error: 'AI not configured' });

    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: { direction: true, content: true, type: true },
    });

    const text = messages
      .filter(m => m.content)
      .map(m => `${m.direction === 'INBOUND' ? 'Customer' : 'Agent'}: ${m.content}`)
      .join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'Summarize this customer support conversation in 2-3 sentences.' },
        { role: 'user', content: text },
      ],
      max_tokens: 200,
    });

    const summary = completion.choices[0].message.content;
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { summary },
    });

    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const predictLeadScore = async (req: AuthRequest, res: Response) => {
  try {
    const client = await getOpenAI();
    if (!client) return res.status(503).json({ error: 'AI not configured' });

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, organizationId: req.user!.organizationId },
      include: { contact: true, activities: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const prompt = `Based on this lead data, provide a score from 0-100 and brief reasoning:
Lead: ${lead.title}
Source: ${lead.source}
Status: ${lead.status}
Budget: ${lead.budget || 'unknown'}
Contact interactions: ${lead.activities.length}
Days since creation: ${Math.floor((Date.now() - lead.createdAt.getTime()) / 86400000)}

Respond in JSON format: {"score": number, "reasoning": "string", "nextAction": "string"}`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 300,
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    await prisma.lead.update({
      where: { id: lead.id },
      data: { score: result.score },
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const translateMessage = async (req: AuthRequest, res: Response) => {
  try {
    const client = await getOpenAI();
    if (!client) return res.status(503).json({ error: 'AI not configured' });

    const { text, targetLanguage } = req.body;

    const completion = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Translate the following text to ${targetLanguage}. Return only the translated text.` },
        { role: 'user', content: text },
      ],
      max_tokens: 500,
    });

    res.json({ translated: completion.choices[0].message.content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const generateMessageTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const client = await getOpenAI();
    if (!client) return res.status(503).json({ error: 'AI not configured' });

    const { purpose, tone, industry } = req.body;

    const completion = await client.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are a WhatsApp marketing expert. Generate a WhatsApp message template for businesses.
          Return JSON with: {"subject": "string", "body": "string", "variables": ["var1", "var2"], "footer": "string"}`,
        },
        {
          role: 'user',
          content: `Create a ${tone} WhatsApp template for ${industry} business for: ${purpose}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 400,
    });

    res.json(JSON.parse(completion.choices[0].message.content || '{}'));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const smartRouting = async (req: AuthRequest, res: Response) => {
  try {
    const { conversationId } = req.body;
    const orgId = req.user!.organizationId;

    const [conversation, agents] = await Promise.all([
      prisma.conversation.findFirst({
        where: { id: conversationId, organizationId: orgId },
        include: { contact: true, messages: { orderBy: { createdAt: 'desc' }, take: 3 } },
      }),
      prisma.user.findMany({
        where: { organizationId: orgId, isActive: true, role: { in: ['AGENT', 'MANAGER'] } },
        include: {
          assignedConversations: { where: { status: 'OPEN' }, select: { id: true } },
        },
      }),
    ]);

    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Simple round-robin + load balancing
    const sortedAgents = agents.sort((a, b) => 
      a.assignedConversations.length - b.assignedConversations.length
    );

    const bestAgent = sortedAgents[0];
    if (bestAgent) {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { agentId: bestAgent.id },
      });
    }

    res.json({ assignedTo: bestAgent?.id, agentName: bestAgent ? `${bestAgent.firstName} ${bestAgent.lastName}` : null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
