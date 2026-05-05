"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessageVolume = exports.getRevenueChart = exports.getLeadsBySource = exports.getAgentPerformance = exports.getConversionFunnel = exports.getDashboardStats = void 0;
const database_1 = require("../config/database");
const getDashboardStats = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const { from, to } = req.query;
        const dateFilter = {};
        if (from)
            dateFilter.gte = new Date(from);
        if (to)
            dateFilter.lte = new Date(to);
        const createdAt = Object.keys(dateFilter).length ? dateFilter : undefined;
        const [totalContacts, newLeads, openConversations, resolvedConversations, dealsWon, dealsOpen, totalRevenue, broadcastsSent, messagesIn, messagesOut,] = await Promise.all([
            database_1.prisma.contact.count({ where: { organizationId: orgId, ...(createdAt && { createdAt }) } }),
            database_1.prisma.lead.count({ where: { organizationId: orgId, ...(createdAt && { createdAt }) } }),
            database_1.prisma.conversation.count({ where: { organizationId: orgId, status: 'OPEN' } }),
            database_1.prisma.conversation.count({ where: { organizationId: orgId, status: 'RESOLVED', ...(createdAt && { resolvedAt: createdAt }) } }),
            database_1.prisma.deal.count({ where: { organizationId: orgId, status: 'WON', ...(createdAt && { closedAt: createdAt }) } }),
            database_1.prisma.deal.count({ where: { organizationId: orgId, status: 'OPEN' } }),
            database_1.prisma.deal.aggregate({
                where: { organizationId: orgId, status: 'WON', ...(createdAt && { closedAt: createdAt }) },
                _sum: { value: true },
            }),
            database_1.prisma.broadcast.count({ where: { organizationId: orgId, status: 'COMPLETED', ...(createdAt && { completedAt: createdAt }) } }),
            database_1.prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'INBOUND', ...(createdAt && { createdAt }) } }),
            database_1.prisma.message.count({ where: { conversation: { organizationId: orgId }, direction: 'OUTBOUND', ...(createdAt && { createdAt }) } }),
        ]);
        res.json({
            totalContacts,
            newLeads,
            openConversations,
            resolvedConversations,
            dealsWon,
            dealsOpen,
            totalRevenue: totalRevenue._sum.value || 0,
            broadcastsSent,
            messagesIn,
            messagesOut,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getDashboardStats = getDashboardStats;
const getConversionFunnel = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const [contacts, leads, qualifiedLeads, deals, wonDeals] = await Promise.all([
            database_1.prisma.contact.count({ where: { organizationId: orgId } }),
            database_1.prisma.lead.count({ where: { organizationId: orgId } }),
            database_1.prisma.lead.count({ where: { organizationId: orgId, status: 'QUALIFIED' } }),
            database_1.prisma.deal.count({ where: { organizationId: orgId } }),
            database_1.prisma.deal.count({ where: { organizationId: orgId, status: 'WON' } }),
        ]);
        res.json([
            { stage: 'Contacts', count: contacts },
            { stage: 'Leads', count: leads },
            { stage: 'Qualified', count: qualifiedLeads },
            { stage: 'Deals', count: deals },
            { stage: 'Won', count: wonDeals },
        ]);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getConversionFunnel = getConversionFunnel;
const getAgentPerformance = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const agents = await database_1.prisma.user.findMany({
            where: { organizationId: orgId, isActive: true },
            select: {
                id: true, firstName: true, lastName: true, avatar: true,
                assignedConversations: {
                    where: { status: 'RESOLVED' },
                    select: { id: true },
                },
                performanceMetrics: { orderBy: { date: 'desc' }, take: 7 },
            },
        });
        const data = agents.map(agent => ({
            id: agent.id,
            name: `${agent.firstName} ${agent.lastName}`,
            avatar: agent.avatar,
            resolvedConversations: agent.assignedConversations.length,
            avgResponseTime: agent.performanceMetrics[0]?.avgResponseTimeSecs || 0,
            csatAvg: agent.performanceMetrics[0]?.csatAvg || 0,
            dealsWon: agent.performanceMetrics.reduce((s, m) => s + m.dealsWon, 0),
        }));
        res.json(data);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAgentPerformance = getAgentPerformance;
const getLeadsBySource = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const data = await database_1.prisma.lead.groupBy({
            by: ['source'],
            where: { organizationId: orgId },
            _count: { _all: true },
        });
        res.json(data.map(d => ({ source: d.source, count: d._count._all })));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getLeadsBySource = getLeadsBySource;
const getRevenueChart = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const deals = await database_1.prisma.deal.findMany({
            where: { organizationId: orgId, status: 'WON', closedAt: { not: null } },
            select: { value: true, closedAt: true },
            orderBy: { closedAt: 'asc' },
        });
        // Group by month
        const monthly = {};
        for (const deal of deals) {
            const month = deal.closedAt.toISOString().slice(0, 7);
            monthly[month] = (monthly[month] || 0) + deal.value;
        }
        res.json(Object.entries(monthly).map(([month, revenue]) => ({ month, revenue })));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getRevenueChart = getRevenueChart;
const getMessageVolume = async (req, res) => {
    try {
        const orgId = req.user.organizationId;
        const days = Number(req.query.days || 30);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const messages = await database_1.prisma.message.findMany({
            where: { conversation: { organizationId: orgId }, createdAt: { gte: since } },
            select: { direction: true, createdAt: true },
        });
        const daily = {};
        for (const msg of messages) {
            const day = msg.createdAt.toISOString().slice(0, 10);
            if (!daily[day])
                daily[day] = { in: 0, out: 0 };
            if (msg.direction === 'INBOUND')
                daily[day].in++;
            else
                daily[day].out++;
        }
        res.json(Object.entries(daily).map(([date, counts]) => ({ date, ...counts })));
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getMessageVolume = getMessageVolume;
//# sourceMappingURL=analyticsController.js.map