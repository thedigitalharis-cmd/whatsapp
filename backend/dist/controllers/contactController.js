"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContactGroup = exports.getContactGroups = exports.mergeContacts = exports.bulkImportContacts = exports.bulkDeleteContacts = exports.bulkArchiveContacts = exports.unarchiveContact = exports.archiveContact = exports.deleteContact = exports.updateContact = exports.createContact = exports.getContact = exports.getContacts = void 0;
const database_1 = require("../config/database");
const getContacts = async (req, res) => {
    try {
        const { page = 1, limit = 50, search, source, groupId, tagId, archived } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const where = {
            organizationId: req.user.organizationId,
            isArchived: archived === 'true' ? true : false,
        };
        if (search) {
            where.OR = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { company: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (source)
            where.source = source;
        if (groupId)
            where.groups = { some: { id: groupId } };
        if (tagId)
            where.tags = { some: { id: tagId } };
        const [contacts, total] = await Promise.all([
            database_1.prisma.contact.findMany({
                where, skip, take: Number(limit),
                include: { tags: true, groups: true },
                orderBy: { createdAt: 'desc' },
            }),
            database_1.prisma.contact.count({ where }),
        ]);
        res.json({ data: contacts, total, page: Number(page), limit: Number(limit) });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getContacts = getContacts;
const getContact = async (req, res) => {
    try {
        const contact = await database_1.prisma.contact.findFirst({
            where: { id: req.params.id, organizationId: req.user.organizationId },
            include: {
                tags: true,
                groups: true,
                leads: { orderBy: { createdAt: 'desc' }, take: 5 },
                deals: { include: { stage: true }, orderBy: { createdAt: 'desc' }, take: 5 },
                conversations: { orderBy: { lastMessageAt: 'desc' }, take: 5 },
                tickets: { orderBy: { createdAt: 'desc' }, take: 5 },
                activities: { orderBy: { createdAt: 'desc' }, take: 10 },
                notes_rel: { orderBy: { createdAt: 'desc' }, take: 10 },
                orders: { orderBy: { createdAt: 'desc' }, take: 5 },
            },
        });
        if (!contact)
            return res.status(404).json({ error: 'Contact not found' });
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getContact = getContact;
const createContact = async (req, res) => {
    try {
        const contact = await database_1.prisma.contact.create({
            data: { ...req.body, organizationId: req.user.organizationId },
            include: { tags: true },
        });
        res.status(201).json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createContact = createContact;
const updateContact = async (req, res) => {
    try {
        const { tags, groups, ...data } = req.body;
        const contact = await database_1.prisma.contact.update({
            where: { id: req.params.id },
            data: {
                ...data,
                ...(tags && { tags: { set: tags.map((id) => ({ id })) } }),
                ...(groups && { groups: { set: groups.map((id) => ({ id })) } }),
            },
            include: { tags: true, groups: true },
        });
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.updateContact = updateContact;
const deleteContact = async (req, res) => {
    try {
        await database_1.prisma.contact.delete({ where: { id: req.params.id } });
        res.json({ message: 'Contact deleted' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.deleteContact = deleteContact;
const archiveContact = async (req, res) => {
    try {
        const contact = await database_1.prisma.contact.update({
            where: { id: req.params.id },
            data: { isArchived: true, archivedAt: new Date() },
        });
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.archiveContact = archiveContact;
const unarchiveContact = async (req, res) => {
    try {
        const contact = await database_1.prisma.contact.update({
            where: { id: req.params.id },
            data: { isArchived: false, archivedAt: null },
        });
        res.json(contact);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.unarchiveContact = unarchiveContact;
const bulkArchiveContacts = async (req, res) => {
    try {
        const { contactIds } = req.body;
        await database_1.prisma.contact.updateMany({
            where: { id: { in: contactIds }, organizationId: req.user.organizationId },
            data: { isArchived: true, archivedAt: new Date() },
        });
        res.json({ archived: contactIds.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.bulkArchiveContacts = bulkArchiveContacts;
const bulkDeleteContacts = async (req, res) => {
    try {
        const { contactIds } = req.body;
        await database_1.prisma.contact.deleteMany({
            where: { id: { in: contactIds }, organizationId: req.user.organizationId },
        });
        res.json({ deleted: contactIds.length });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.bulkDeleteContacts = bulkDeleteContacts;
const bulkImportContacts = async (req, res) => {
    try {
        const { contacts } = req.body;
        const result = await database_1.prisma.contact.createMany({
            data: contacts.map((c) => ({ ...c, organizationId: req.user.organizationId })),
            skipDuplicates: true,
        });
        res.json({ imported: result.count });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.bulkImportContacts = bulkImportContacts;
const mergeContacts = async (req, res) => {
    try {
        const { primaryId, duplicateId } = req.body;
        await database_1.prisma.contact.update({ where: { id: duplicateId }, data: { mergedIntoId: primaryId } });
        res.json({ message: 'Contacts merged' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.mergeContacts = mergeContacts;
const getContactGroups = async (req, res) => {
    try {
        const groups = await database_1.prisma.contactGroup.findMany({ orderBy: { name: 'asc' } });
        res.json(groups);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getContactGroups = getContactGroups;
const createContactGroup = async (req, res) => {
    try {
        const group = await database_1.prisma.contactGroup.create({ data: req.body });
        res.status(201).json(group);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.createContactGroup = createContactGroup;
//# sourceMappingURL=contactController.js.map