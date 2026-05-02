import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BuildingOfficeIcon, UsersIcon, ChatBubbleLeftRightIcon,
  BoltIcon, CreditCardIcon, ShieldCheckIcon, QrCodeIcon,
  LinkIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { orgApi, usersApi, teamsApi, whatsappApi, qrApi, tagsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const settingsNav = [
  { path: '', label: 'General', icon: BuildingOfficeIcon },
  { path: 'users', label: 'Users & Teams', icon: UsersIcon },
  { path: 'whatsapp', label: 'WhatsApp Accounts', icon: ChatBubbleLeftRightIcon },
  { path: 'automations', label: 'Integrations', icon: BoltIcon },
  { path: 'billing', label: 'Billing', icon: CreditCardIcon },
  { path: 'security', label: 'Security', icon: ShieldCheckIcon },
  { path: 'qr-codes', label: 'QR Codes', icon: QrCodeIcon },
  { path: 'tags', label: 'Tags', icon: LinkIcon },
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
          <Route path="whatsapp" element={<WhatsAppSettings />} />
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
