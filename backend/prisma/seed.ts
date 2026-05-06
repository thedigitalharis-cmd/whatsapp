import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-crm' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-crm',
      plan: 'PROFESSIONAL',
    },
  });

  // Create admin user
  const passwordHash = await bcrypt.hash('Admin123!', 12);
  const admin = await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      organizationId: org.id,
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@demo.com',
      passwordHash,
      role: 'ADMIN',
      isEmailVerified: true,
    },
  });

  // Create agent user
  const agentHash = await bcrypt.hash('Agent123!', 12);
  await prisma.user.upsert({
    where: { organizationId_email: { organizationId: org.id, email: 'agent@demo.com' } },
    update: {},
    create: {
      organizationId: org.id,
      firstName: 'Sarah',
      lastName: 'Agent',
      email: 'agent@demo.com',
      passwordHash: agentHash,
      role: 'AGENT',
      isEmailVerified: true,
    },
  });

  // Create default pipeline
  const existingPipeline = await prisma.pipeline.findFirst({ where: { organizationId: org.id } });
  let pipeline;
  if (!existingPipeline) {
    pipeline = await prisma.pipeline.create({
      data: { organizationId: org.id, name: 'Sales Pipeline', isDefault: true },
    });
    await prisma.pipelineStage.createMany({
      data: [
        { pipelineId: pipeline.id, name: 'New Lead', order: 1, probability: 10, color: '#6366f1' },
        { pipelineId: pipeline.id, name: 'Contacted', order: 2, probability: 25, color: '#3b82f6' },
        { pipelineId: pipeline.id, name: 'Proposal', order: 3, probability: 50, color: '#f59e0b' },
        { pipelineId: pipeline.id, name: 'Negotiation', order: 4, probability: 75, color: '#10b981' },
        { pipelineId: pipeline.id, name: 'Closed Won', order: 5, probability: 100, color: '#22c55e' },
        { pipelineId: pipeline.id, name: 'Closed Lost', order: 6, probability: 0, color: '#ef4444' },
      ],
    });
  } else {
    pipeline = existingPipeline;
  }

  // Create sample tags
  const tagData = [
    { name: '🔥 Hot Lead',       color: '#ef4444' },
    { name: '⭐ VIP',            color: '#f59e0b' },
    { name: '✅ Interested',     color: '#22c55e' },
    { name: '🔔 Follow-up',     color: '#3b82f6' },
    { name: '❌ Not Interested', color: '#6b7280' },
    { name: '💰 Paid Client',    color: '#8b5cf6' },
    { name: '🆕 New Lead',       color: '#06b6d4' },
    { name: '⏳ Pending',        color: '#f97316' },
  ];
  for (const tag of tagData) {
    await prisma.tag.upsert({
      where: { organizationId_name: { organizationId: org.id, name: tag.name } },
      update: {},
      create: { organizationId: org.id, ...tag },
    });
  }

  // Create sample contacts
  const contacts = [];
  for (let i = 1; i <= 20; i++) {
    const contact = await prisma.contact.upsert({
      where: { organizationId_phone: { organizationId: org.id, phone: `+1555000${i.toString().padStart(4, '0')}` } },
      update: {},
      create: {
        organizationId: org.id,
        firstName: ['Alice', 'Bob', 'Charlie', 'Diana', 'Evan', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia',
          'Kevin', 'Laura', 'Mike', 'Nancy', 'Oscar', 'Paula', 'Quinn', 'Rachel', 'Steve', 'Tina'][i - 1],
        lastName: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Taylor',
          'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Robinson', 'Clark', 'Lewis'][i - 1],
        phone: `+1555000${i.toString().padStart(4, '0')}`,
        email: `contact${i}@example.com`,
        company: `Company ${i}`,
        source: ['WHATSAPP', 'WEB_FORM', 'INSTAGRAM', 'FACEBOOK_ADS', 'MANUAL'][i % 5] as any,
        gdprConsent: i % 2 === 0,
      },
    });
    contacts.push(contact);
  }

  // Create sample leads
  const stages = await prisma.pipelineStage.findMany({ where: { pipeline: { organizationId: org.id } } });
  for (let i = 0; i < 10; i++) {
    const contact = contacts[i];
    await prisma.lead.create({
      data: {
        organizationId: org.id,
        contactId: contact.id,
        assigneeId: admin.id,
        title: `Lead - ${contact.firstName} ${contact.lastName}`,
        source: ['WHATSAPP', 'WEB_FORM', 'INSTAGRAM', 'FACEBOOK_ADS', 'MANUAL'][i % 5] as any,
        status: ['NEW', 'CONTACTED', 'QUALIFIED', 'NEW', 'CONTACTED'][i % 5] as any,
        score: 20 + (i * 8),
        budget: (i + 1) * 500,
      },
    });
  }

  // Create sample deals
  if (stages.length > 0) {
    for (let i = 0; i < 8; i++) {
      const contact = contacts[i + 10];
      const stage = stages[i % stages.length];
      await prisma.deal.create({
        data: {
          organizationId: org.id,
          contactId: contact.id,
          assigneeId: admin.id,
          stageId: stage.id,
          title: `Deal - ${contact.firstName}`,
          value: (i + 1) * 1500,
          probability: stage.probability,
          status: i < 6 ? 'OPEN' : i === 6 ? 'WON' : 'LOST',
          closedAt: i >= 6 ? new Date() : null,
        },
      });
    }
  }

  // Create sample knowledge base articles
  const articles = [
    { title: 'How to track my order?', content: 'You can track your order by visiting our tracking page at...', category: 'FAQ', tags: ['order', 'tracking'] },
    { title: 'Refund Policy', content: 'We offer a 30-day money-back guarantee. To request a refund...', category: 'Policies', tags: ['refund', 'policy'] },
    { title: 'How to contact support?', content: 'You can reach our support team via WhatsApp at...', category: 'Support', tags: ['contact', 'support'] },
  ];
  for (const article of articles) {
    await prisma.knowledgeBase.create({
      data: { organizationId: org.id, ...article },
    });
  }

  // Create a sample automation
  await prisma.automation.create({
    data: {
      organizationId: org.id,
      name: 'Welcome Bot',
      description: 'Greet new customers automatically',
      type: 'CHATBOT',
      status: 'ACTIVE',
      aiEnabled: false,
      trigger: { event: 'message_received', isFirstMessage: true },
      flow: {
        nodes: [
          { id: 'start', type: 'trigger', data: { label: 'First Message Received' } },
          { id: 'send', type: 'sendMessage', data: { message: 'Hello! Welcome to our service. How can I help you today?' } },
          { id: 'options', type: 'buttons', data: { message: 'Choose an option:', buttons: ['Products', 'Support', 'Talk to Agent'] } },
        ],
        edges: [{ source: 'start', target: 'send' }, { source: 'send', target: 'options' }],
      },
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Admin: admin@demo.com / Admin123!');
  console.log('  Agent: agent@demo.com / Agent123!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
