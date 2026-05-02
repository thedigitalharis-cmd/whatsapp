# WhatsApp CRM — Complete Automation Platform

A full-featured, enterprise-grade CRM built specifically for WhatsApp Business API automation. Built with React, Node.js, TypeScript, PostgreSQL, and Socket.IO.

---

## Features

### Authentication & User Management
- JWT-based authentication with refresh tokens
- Two-Factor Authentication (TOTP/Google Authenticator)
- Google OAuth SSO
- Role-Based Access Control: Super Admin, Admin, Manager, Agent, Viewer
- Team management
- User audit logs
- Session management

### WhatsApp API Integration
- **Cloud API** (Meta Business Platform) + On-Premise support
- Multiple WhatsApp number accounts per organization
- Green Tick (Verified Business) status tracking
- Webhook handler for real-time message processing
- Message status tracking (Sent → Delivered → Read)
- Rich media support: Images, Videos, Audio, Documents, Stickers, Location
- Interactive messages: Buttons, List messages
- Template management with approval workflow
- QR Code generator for WhatsApp links

### Leads Management
- Auto-capture from WhatsApp, Web Forms, Instagram, Facebook Ads
- AI-powered lead scoring (BANT/CHAMP models)
- Kanban pipeline view
- Assignment rules
- UTM tracking (source, medium, campaign, content, term)
- Bulk import/export
- Tagging & segmentation
- Lead-to-deal conversion
- Bulk assignment

### Chat & Messaging (Unified Inbox)
- Multi-channel inbox: WhatsApp, Instagram, Messenger, Telegram, SMS, Email
- Agent assignment & team routing
- Internal notes
- Quick replies from Knowledge Base
- Message tagging
- Conversation transfer
- Status management (Open, Pending, Resolved, Snoozed)
- Real-time typing indicators (Socket.IO)
- Chat history
- AI-generated reply suggestions (GPT-4)
- Bot pause/resume per conversation

### Automation & Chatbots
- No-code chatbot flow builder (stored as JSON)
- AI/GPT-powered bots with custom system prompts
- NLP intent detection
- Conditional flows
- Human handover support
- Assignment rules
- Auto-reply workflows
- Trigger-based automations

### Broadcast & Campaigns
- Scheduled bulk messaging
- Contact segmentation filters
- Drip sequences (Campaign steps with delays)
- A/B testing support
- Personalization with template variables
- Opt-out management
- Real-time delivery tracking (Sent/Delivered/Read/Failed)
- Rate-limited sending (WhatsApp API compliant)

### Sales Pipelines & Deals
- Customizable pipeline stages with probability
- Kanban drag-and-drop board
- Deal value forecasting
- Won/Lost tracking
- Recurring deals support
- Quotation URL attachment
- Revenue analytics

### Contact Management
- Custom fields (Text, Number, Date, Select, etc.)
- Contact groups
- GDPR consent tracking
- Duplicate merging
- Bulk import via CSV
- 360° contact view (leads, deals, conversations, orders, tickets)
- Tagging

### Reports & Analytics
- Real-time dashboard with KPIs
- Message volume charts (Inbound/Outbound)
- Revenue charts (Monthly Won Deals)
- Lead conversion funnel
- Lead source breakdown (Pie chart)
- Agent performance metrics
- CSAT/NPS scoring
- Date range filtering

### Commerce
- Product catalog management
- Order management
- Payment status tracking
- Payment link support
- Abandoned cart recovery
- WhatsApp catalog integration fields

### Ticketing & Support
- SLA deadline tracking
- Priority management (Low/Normal/High/Urgent)
- CSAT & NPS scoring per ticket
- Ticket escalation
- Knowledge base integration
- Agent assignment

### AI Features (GPT-4 Powered)
- **AI Copilot**: Suggested replies based on conversation context
- **Conversation summarization**
- **Predictive lead scoring** with reasoning & next action
- **Real-time translation** (any language)
- **Smart agent routing** (load-balanced assignment)
- **AI template generator** (tone/industry/purpose)

### Integrations
- HubSpot, Salesforce, Zoho (via Integration config)
- Shopify, WooCommerce
- Stripe payment processing
- Razorpay
- Google Calendar
- Zapier (via webhook)
- Custom REST API webhooks
- QR Code generator for WhatsApp links

### Security & Compliance
- GDPR consent tracking per contact
- Field-level data privacy
- Encrypted passwords (bcrypt)
- JWT token rotation
- Rate limiting (express-rate-limit)
- Audit log trail
- Multi-tenant isolation (organizationId scoping)
- Helmet.js security headers

### Admin & Multi-Tenant
- Organization-scoped data
- Custom branding fields
- Plan management (Starter/Growth/Professional/Enterprise)
- Billing subscription management (Stripe-ready)
- Custom fields per entity
- Gamification points for agents
- Agent performance metrics

---

## Tech Stack

| Layer        | Technology                          |
|-------------|-------------------------------------|
| Frontend    | React 18, TypeScript, Tailwind CSS  |
| State       | Zustand, TanStack Query             |
| Charts      | Recharts                            |
| Realtime    | Socket.IO                           |
| Backend     | Node.js, Express, TypeScript        |
| Database    | PostgreSQL (via Prisma ORM)         |
| Cache/Queue | Redis, Bull                         |
| AI          | OpenAI GPT-4                        |
| Auth        | JWT, bcrypt, speakeasy (2FA)        |
| WhatsApp    | Meta Cloud API v19.0                |
| Payments    | Stripe                              |
| Container   | Docker + Docker Compose             |
| Proxy       | Nginx                               |

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- PostgreSQL 16 (or use Docker)

### 1. Clone & Configure

```bash
git clone <repo-url>
cd whatsapp-crm
cp .env.example .env
# Edit .env with your credentials
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

The app will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Via Nginx**: http://localhost:80

### 3. Run Migrations & Seed

```bash
cd backend
cp .env.example .env
# Edit backend/.env
npm install
npx prisma migrate dev
npx ts-node prisma/seed.ts
```

Demo credentials after seeding:
- **Admin**: admin@demo.com / Admin123!
- **Agent**: agent@demo.com / Agent123!

### 4. Local Development

```bash
# Backend
cd backend
npm install
npm run dev   # Starts on :5000

# Frontend (new terminal)
cd frontend
npm install
npm start     # Starts on :3000
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | JWT signing secret (32+ chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `PORT` | Server port (default: 5000) |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Token for webhook verification |
| `OPENAI_API_KEY` | OpenAI key for AI features |
| `STRIPE_SECRET_KEY` | Stripe key for billing |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend API URL |
| `REACT_APP_WS_URL` | WebSocket server URL |

---

## WhatsApp Setup

1. Create a [Meta Business App](https://developers.facebook.com/)
2. Add WhatsApp product to your app
3. Get your `Phone Number ID`, `Business Account ID`, and `Access Token`
4. Set webhook URL: `https://your-domain.com/webhook/whatsapp`
5. Add your WhatsApp account in **Settings → WhatsApp Accounts**

---

## API Reference

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/register` | Register new organization |
| `POST /api/auth/login` | Login with email/password |
| `GET /api/contacts` | List contacts (paginated) |
| `GET /api/leads` | List leads with filters |
| `GET /api/conversations` | Unified inbox |
| `POST /api/conversations/:id/messages` | Send message |
| `GET /api/analytics/dashboard` | Dashboard KPIs |
| `POST /api/broadcasts/:id/launch` | Launch broadcast |
| `POST /api/ai/reply` | AI suggested reply |
| `POST /api/ai/conversations/:id/summarize` | Summarize conversation |
| `POST /webhook/whatsapp` | WhatsApp webhook receiver |

Full OpenAPI spec available at `/api/docs` (when in development mode).

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   React     │────▶│   Nginx     │────▶│  Express API │
│  Frontend   │     │   Proxy     │     │  (Node.js)   │
└─────────────┘     └─────────────┘     └──────┬───────┘
                                               │
                          ┌────────────────────┼────────────────────┐
                          │                    │                    │
                    ┌─────▼─────┐      ┌──────▼──────┐    ┌───────▼──────┐
                    │PostgreSQL │      │    Redis     │    │  WhatsApp    │
                    │ (Prisma)  │      │   Cache/     │    │  Cloud API   │
                    └───────────┘      │    Queue     │    └──────────────┘
                                       └─────────────┘
```

---

## License

MIT License — Free to use and modify.
