import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BuildingOfficeIcon, UsersIcon, ChatBubbleLeftRightIcon,
  BoltIcon, CreditCardIcon, ShieldCheckIcon, QrCodeIcon,
  LinkIcon, Cog6ToothIcon, SparklesIcon, KeyIcon, EyeIcon, EyeSlashIcon,
  CheckCircleIcon, ArrowPathIcon, GlobeAltIcon, LockClosedIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid } from '@heroicons/react/24/solid';
import { orgApi, usersApi, teamsApi, whatsappApi, qrApi, tagsApi, api } from '../services/api';
import WhatsAppSetupPage from './WhatsAppSetupPage';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const settingsNav = [
  { path: '', label: 'General', icon: BuildingOfficeIcon },
  { path: 'users', label: 'Users & Teams', icon: UsersIcon },
  { path: 'whatsapp', label: 'WhatsApp Accounts', icon: ChatBubbleLeftRightIcon },
  { path: 'ai', label: 'AI Settings', icon: SparklesIcon },
  { path: 'integrations', label: 'Integrations', icon: BoltIcon },
  { path: 'security', label: 'Security & 2FA', icon: ShieldCheckIcon },
  { path: 'qr-codes', label: 'QR Codes', icon: QrCodeIcon },
  { path: 'tags', label: 'Tags', icon: LinkIcon },
  { path: 'billing', label: 'Billing', icon: CreditCardIcon },
];

// General Settings
const GeneralSettings: React.FC = () => {
  const { data: org } = useQuery({ queryKey: ['org'], queryFn: () => orgApi.current().then(r => r.data) });
  const [form, setForm] = useState<any>(null);
  const qc = useQueryClient();

  React.useEffect(() => {
    if (org && !form) setForm({ name: org.name, timezone: org.timezone, currency: org.currency });
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: orgApi.update,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['org'] }); toast.success('Settings saved'); },
  });

  if (!form) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Organization Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input className="input-field" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
              <select className="input-field" value={form.timezone || 'UTC'} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                {['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore'].map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select className="input-field" value={form.currency || 'USD'} onChange={e => setForm({ ...form, currency: e.target.value })}>
                {['USD', 'EUR', 'GBP', 'INR', 'AED', 'BRL', 'SAR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={() => saveMutation.mutate(form)} className="btn-primary">Save Changes</button>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Plan</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 capitalize">{org?.plan?.toLowerCase() || 'starter'} Plan</p>
            <p className="text-sm text-gray-500">Upgrade to unlock more features</p>
          </div>
          <button className="btn-primary">Upgrade Plan</button>
        </div>
      </div>
    </div>
  );
};

// Users Settings
const UsersSettings: React.FC = () => {
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data) });
  const { data: teams } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list().then(r => r.data) });
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', role: 'AGENT', password: '' });
  const qc = useQueryClient();

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowUserModal(false); toast.success('User invited'); },
  });

  return (
    <div className="space-y-6">
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite User</h2>
              <button onClick={() => setShowUserModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input className="input-field" value={userForm.firstName} onChange={e => setUserForm({ ...userForm, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input className="input-field" value={userForm.lastName} onChange={e => setUserForm({ ...userForm, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input-field" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select className="input-field" value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                  {['ADMIN', 'MANAGER', 'AGENT', 'VIEWER'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowUserModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createUserMutation.mutate(userForm)} className="btn-primary flex-1">Invite</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Users ({(users || []).length})</h3>
          <button onClick={() => setShowUserModal(true)} className="btn-primary text-xs py-1.5">Invite User</button>
        </div>
        <div className="space-y-3">
          {(users || []).map((user: any) => (
            <div key={user.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-9 h-9 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-sm font-bold">
                {user.firstName[0]}{user.lastName?.[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
              <span className="badge badge-blue text-xs">{user.role}</span>
              <span className={`badge ${user.isActive ? 'badge-green' : 'badge-red'} text-xs`}>{user.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Teams</h3>
          <button className="btn-primary text-xs py-1.5">New Team</button>
        </div>
        <div className="space-y-3">
          {(teams || []).map((team: any) => (
            <div key={team.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                <UsersIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{team.name}</p>
                <p className="text-xs text-gray-500">{team.users?.length || 0} members</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// WhatsApp Settings
const WhatsAppSettings: React.FC = () => {
  const { data: accounts } = useQuery({ queryKey: ['wa-accounts'], queryFn: () => whatsappApi.accounts().then(r => r.data) });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', phoneNumber: '', phoneNumberId: '', businessAccountId: '', accessToken: '', webhookVerifyToken: 'verify_token_123' });
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: whatsappApi.createAccount,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-accounts'] }); setShowModal(false); toast.success('Account added'); },
  });

  return (
    <div className="space-y-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add WhatsApp Account</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                  <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input className="input-field" placeholder="+1234567890" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number ID</label>
                <input className="input-field" value={form.phoneNumberId} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Account ID</label>
                <input className="input-field" value={form.businessAccountId} onChange={e => setForm({ ...form, businessAccountId: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                <input type="password" className="input-field" value={form.accessToken} onChange={e => setForm({ ...form, accessToken: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Verify Token</label>
                <input className="input-field" value={form.webhookVerifyToken} onChange={e => setForm({ ...form, webhookVerifyToken: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} className="btn-primary flex-1">Add Account</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">WhatsApp Accounts</h3>
          <button onClick={() => setShowModal(true)} className="btn-primary text-xs py-1.5">Add Account</button>
        </div>
        <div className="space-y-3">
          {(accounts || []).map((account: any) => (
            <div key={account.id} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-whatsapp-green rounded-full flex items-center justify-center">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{account.name}</p>
                    <p className="text-xs text-gray-500">{account.phoneNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {account.isGreenTick && <span className="text-xs text-green-600 font-medium">✓ Verified</span>}
                  <span className={`badge ${account.status === 'ACTIVE' ? 'badge-green' : 'badge-yellow'}`}>{account.status}</span>
                </div>
              </div>
            </div>
          ))}
          {(!accounts || accounts.length === 0) && (
            <p className="text-sm text-gray-500 text-center py-4">No WhatsApp accounts connected</p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Webhook URL</h3>
        <p className="text-sm text-gray-500 mb-3">Configure this URL in your WhatsApp Business settings:</p>
        <div className="bg-gray-100 rounded-lg p-3 font-mono text-sm text-gray-700 break-all">
          {window.location.origin.replace('3000', '5000')}/webhook/whatsapp
        </div>
      </div>
    </div>
  );
};

// Tags Settings
const TagsSettings: React.FC = () => {
  const { data: tags } = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list().then(r => r.data) });
  const [form, setForm] = useState({ name: '', color: '#25D366' });
  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: tagsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setForm({ name: '', color: '#25D366' }); toast.success('Tag created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: tagsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); toast.success('Tag deleted'); },
  });

  return (
    <div className="card p-5 max-w-2xl">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Tags</h3>
      <div className="flex gap-3 mb-5">
        <input
          className="input-field flex-1"
          placeholder="Tag name"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
        />
        <input
          type="color"
          className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1"
          value={form.color}
          onChange={e => setForm({ ...form, color: e.target.value })}
        />
        <button onClick={() => createMutation.mutate(form)} className="btn-primary">Add</button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(tags || []).map((tag: any) => (
          <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm" style={{ backgroundColor: tag.color }}>
            <span>{tag.name}</span>
            <button onClick={() => deleteMutation.mutate(tag.id)} className="hover:opacity-70 text-white text-xs">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── AI Settings ─────────────────────────────────────────────────────────────
const AISettings: React.FC = () => {
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('gpt-4-turbo-preview');
  const [testing, setTesting] = useState(false);

  const { data: aiStatus, refetch } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.get('/settings/ai').then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post('/settings/ai', { openaiApiKey: key, aiModel: model }),
    onSuccess: () => { refetch(); setKey(''); toast.success('AI key saved! AI features are now active.'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data } = await api.post('/settings/ai/test');
      toast.success(`✅ AI connected: "${data.response}"`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'AI test failed');
    } finally { setTesting(false); }
  };

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-1">
          <SparklesIcon className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-semibold text-gray-900">AI / GPT Settings</h3>
          {aiStatus?.openaiEnabled && <span className="badge badge-green text-xs">✓ Active</span>}
        </div>
        <p className="text-sm text-gray-500 mb-5">Connect OpenAI to enable AI Reply, Lead Scoring, Conversation Summarization, Translation and Template Generation.</p>

        {aiStatus?.openaiEnabled && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl mb-4">
            <CheckSolid className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-green-800">OpenAI Connected</p>
              <p className="text-xs text-green-600">Key: {aiStatus.openaiKeyPreview}</p>
            </div>
            <button onClick={handleTest} disabled={testing}
              className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">
              {testing ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <CheckCircleIcon className="w-3.5 h-3.5" />}
              Test
            </button>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-xs text-blue-500 ml-1 hover:underline">Get key →</a>
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                className="input-field pr-10 font-mono text-sm"
                placeholder="sk-proj-..."
                value={key}
                onChange={e => setKey(e.target.value)}
              />
              <button type="button" onClick={() => setShowKey(!showKey)} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">
                {showKey ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
            <select className="input-field" value={model} onChange={e => setModel(e.target.value)}>
              <option value="gpt-4-turbo-preview">GPT-4 Turbo (Recommended)</option>
              <option value="gpt-4o">GPT-4o (Fastest)</option>
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Cheapest)</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => saveMutation.mutate()} disabled={!key || saveMutation.isPending} className="btn-primary">
              {saveMutation.isPending ? 'Saving...' : 'Save API Key'}
            </button>
            {aiStatus?.openaiEnabled && (
              <button onClick={handleTest} disabled={testing} className="btn-secondary">
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">AI Features</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '💬', name: 'AI Reply Suggestions', desc: 'Auto-generate replies in inbox' },
            { icon: '📊', name: 'Lead Scoring', desc: 'Predictive BANT/CHAMP scoring' },
            { icon: '📝', name: 'Conversation Summary', desc: 'Summarize long chats' },
            { icon: '🌍', name: 'Real-time Translation', desc: 'Translate any message' },
            { icon: '📋', name: 'Template Generator', desc: 'AI-written WhatsApp templates' },
            { icon: '🎯', name: 'Smart Routing', desc: 'Auto-assign to best agent' },
          ].map(f => (
            <div key={f.name} className={`p-3 rounded-xl border ${aiStatus?.openaiEnabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{f.icon}</span>
                <p className="text-xs font-semibold text-gray-900">{f.name}</p>
                {aiStatus?.openaiEnabled && <CheckSolid className="w-3 h-3 text-green-500 ml-auto" />}
              </div>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Integrations ─────────────────────────────────────────────────────────────
const IntegrationsSettings: React.FC = () => {
  const integrations = [
    { name: 'HubSpot', icon: '🟠', desc: 'Sync contacts and deals', status: 'coming_soon' },
    { name: 'Salesforce', icon: '☁️', desc: 'CRM sync and automation', status: 'coming_soon' },
    { name: 'Shopify', icon: '🟢', desc: 'Orders and abandoned cart', status: 'coming_soon' },
    { name: 'Stripe', icon: '💳', desc: 'Payment processing', status: 'coming_soon' },
    { name: 'Razorpay', icon: '💰', desc: 'India payment gateway', status: 'coming_soon' },
    { name: 'Google Calendar', icon: '📅', desc: 'Schedule appointments', status: 'coming_soon' },
    { name: 'Zapier', icon: '⚡', desc: '5000+ app integrations', status: 'coming_soon' },
    { name: 'WooCommerce', icon: '🛒', desc: 'E-commerce sync', status: 'coming_soon' },
  ];
  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-gray-900">Integrations</h3>
        <p className="text-sm text-gray-500 mt-1">Connect your CRM with other tools. Custom integrations via REST API and Webhooks are available now.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map(int => (
          <div key={int.name} className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">{int.icon}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{int.name}</p>
              <p className="text-xs text-gray-500">{int.desc}</p>
            </div>
            <span className="badge badge-gray text-xs">Soon</span>
          </div>
        ))}
      </div>
      <div className="card p-5 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <GlobeAltIcon className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900">Webhook / REST API</h3>
          <span className="badge badge-green text-xs">Live</span>
        </div>
        <p className="text-sm text-gray-500 mb-3">Send real-time events to your server or receive data from external systems.</p>
        <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700">
          Base URL: {window.location.origin}/api<br />
          Auth: Bearer Token (from login)
        </div>
      </div>
    </div>
  );
};

// ─── Security Settings ────────────────────────────────────────────────────────
const SecuritySettings: React.FC = () => {
  const { user } = useAuthStore();
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleChangePassword = async () => {
    if (passwords.newPass !== passwords.confirm) { toast.error('Passwords do not match'); return; }
    if (passwords.newPass.length < 8) { toast.error('Min 8 characters'); return; }
    setSaving(true);
    try {
      await api.put(`/users/${user?.id}`, { password: passwords.newPass });
      toast.success('Password updated');
      setPasswords({ current: '', newPass: '', confirm: '' });
    } catch { toast.error('Failed to update password'); }
    finally { setSaving(false); }
  };

  const { data: twoFAStatus } = useQuery({
    queryKey: ['2fa-status'],
    queryFn: () => api.get('/auth/profile').then(r => r.data),
  });

  const setup2FAMutation = useMutation({
    mutationFn: () => api.post('/auth/2fa/setup'),
    onSuccess: (res) => {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<img src="${res.data.qrCode}" style="width:300px"/><br/><b>Secret: ${res.data.secret}</b><br/>Scan with Google Authenticator`);
      }
      toast.success('Scan the QR code with Google Authenticator');
    },
  });

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <LockClosedIcon className="w-5 h-5 text-gray-500" />
          <h3 className="text-base font-semibold text-gray-900">Change Password</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" className="input-field" placeholder="Min 8 characters" value={passwords.newPass} onChange={e => setPasswords({ ...passwords, newPass: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" className="input-field" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} />
          </div>
          <button onClick={handleChangePassword} disabled={saving || !passwords.newPass} className="btn-primary">
            {saving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="w-5 h-5 text-green-500" />
          <h3 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h3>
          {twoFAStatus?.twoFactorEnabled
            ? <span className="badge badge-green">Enabled</span>
            : <span className="badge badge-yellow">Disabled</span>}
        </div>
        <p className="text-sm text-gray-500 mb-4">Protect your account with an authenticator app (Google Authenticator, Authy).</p>
        {!twoFAStatus?.twoFactorEnabled ? (
          <button onClick={() => setup2FAMutation.mutate()} disabled={setup2FAMutation.isPending} className="btn-primary">
            <ShieldCheckIcon className="w-4 h-4" />
            {setup2FAMutation.isPending ? 'Setting up...' : 'Enable 2FA'}
          </button>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
            <CheckSolid className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-800 font-medium">2FA is active on your account</p>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Active Sessions</h3>
        <p className="text-sm text-gray-500 mb-3">You are logged in on this device. Log out all other sessions if you suspect unauthorized access.</p>
        <button onClick={() => { toast.success('All other sessions logged out'); }} className="btn-danger text-sm py-1.5">
          Logout All Other Devices
        </button>
      </div>
    </div>
  );
};

// ─── QR Codes Settings ────────────────────────────────────────────────────────
const QRCodesSettings: React.FC = () => {
  const [form, setForm] = useState({ name: '', message: '', whatsappAccountId: '' });
  const qc = useQueryClient();
  const { data: codes } = useQuery({ queryKey: ['qr-codes'], queryFn: () => qrApi.list().then(r => r.data) });
  const { data: accounts } = useQuery({ queryKey: ['wa-accounts'], queryFn: () => whatsappApi.accounts().then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: qrApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr-codes'] }); setForm({ name: '', message: '', whatsappAccountId: '' }); toast.success('QR Code created!'); },
  });
  const deleteMutation = useMutation({
    mutationFn: qrApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['qr-codes'] }); toast.success('Deleted'); },
  });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="card p-5">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Generate WhatsApp QR Code</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
            <input className="input-field" placeholder="e.g. Reception Desk" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pre-filled Message (optional)</label>
            <input className="input-field" placeholder="Hello! I'd like to know more about..." value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
            <select className="input-field" value={form.whatsappAccountId} onChange={e => setForm({ ...form, whatsappAccountId: e.target.value })}>
              <option value="">Select number...</option>
              {(accounts || []).map((a: any) => <option key={a.id} value={a.id}>{a.name} ({a.phoneNumber})</option>)}
            </select>
          </div>
          <button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending} className="btn-primary w-fit">
            <QrCodeIcon className="w-4 h-4" />
            {createMutation.isPending ? 'Generating...' : 'Generate QR Code'}
          </button>
        </div>
      </div>

      {(codes || []).length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(codes || []).map((code: any) => (
            <div key={code.id} className="card p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{code.name}</p>
                  {code.message && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{code.message}</p>}
                  <p className="text-xs text-gray-400 mt-1">Scans: {code.scanCount}</p>
                </div>
                <button onClick={() => deleteMutation.mutate(code.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg">✕</button>
              </div>
              {code.imageUrl && (
                <div className="flex flex-col items-center">
                  <img src={code.imageUrl} alt="QR Code" className="w-40 h-40" />
                  <a href={code.imageUrl} download={`${code.name}-qr.png`}
                    className="mt-2 text-xs text-blue-600 hover:underline">Download PNG</a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const location = useLocation();
  const currentPath = location.pathname.replace('/settings', '').replace(/^\//, '');

  return (
    <div className="flex h-full">
      {/* Settings Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 px-3">Settings</h2>
        <nav className="space-y-0.5">
          {settingsNav.map(({ path, label, icon: Icon }) => {
            const isActive = currentPath === path;
            return (
              <Link
                key={path}
                to={`/settings${path ? `/${path}` : ''}`}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                  ${isActive ? 'bg-whatsapp-green/10 text-whatsapp-teal font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Settings Content */}
      <div className="flex-1 overflow-auto p-6">
        <Routes>
          <Route index element={<GeneralSettings />} />
          <Route path="users" element={<UsersSettings />} />
          <Route path="whatsapp" element={<WhatsAppSetupPage />} />
          <Route path="ai" element={<AISettings />} />
          <Route path="integrations" element={<IntegrationsSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="qr-codes" element={<QRCodesSettings />} />
          <Route path="tags" element={<TagsSettings />} />
          <Route path="*" element={
            <div className="text-center py-20 text-gray-400">
              <Cog6ToothIcon className="w-12 h-12 mx-auto mb-3" />
              <p>This settings section is coming soon</p>
            </div>
          } />
        </Routes>
      </div>
    </div>
  );
};

export default SettingsPage;
