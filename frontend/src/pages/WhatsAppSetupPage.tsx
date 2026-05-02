import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircleIcon, XCircleIcon, ArrowPathIcon, ClipboardDocumentIcon,
  ChevronRightIcon, ChevronLeftIcon, ExclamationTriangleIcon,
  PhoneIcon, ShieldCheckIcon, ArrowDownTrayIcon, Cog6ToothIcon,
  QrCodeIcon, LinkIcon, TrashIcon, PencilIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckSolid } from '@heroicons/react/24/solid';
import { whatsappApi, api } from '../services/api';
import toast from 'react-hot-toast';

const BACKEND_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
const WEBHOOK_URL = `${BACKEND_URL}/webhook/whatsapp`;

// ─── Step wizard ────────────────────────────────────────────────────────────
const steps = [
  { id: 1, label: 'Meta App Setup' },
  { id: 2, label: 'Account Credentials' },
  { id: 3, label: 'Verify Connection' },
  { id: 4, label: 'Webhook Config' },
  { id: 5, label: 'Business Profile' },
];

// ─── Copy helper ────────────────────────────────────────────────────────────
const CopyField: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs font-medium text-gray-600 mb-1">{label}</p>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
        <code className="flex-1 text-sm text-gray-800 break-all">{value}</code>
        <button onClick={copy} className="text-gray-400 hover:text-whatsapp-teal flex-shrink-0">
          {copied ? <CheckSolid className="w-4 h-4 text-green-500" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// ─── Status badge ────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const cfg: Record<string, { color: string; dot: string }> = {
    ACTIVE:     { color: 'text-green-700 bg-green-50 border-green-200',  dot: 'bg-green-500' },
    PENDING:    { color: 'text-yellow-700 bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
    SUSPENDED:  { color: 'text-red-700 bg-red-50 border-red-200',        dot: 'bg-red-500' },
    BANNED:     { color: 'text-red-700 bg-red-50 border-red-200',        dot: 'bg-red-600' },
  };
  const c = cfg[status] || cfg.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
};

// ─── Main component ─────────────────────────────────────────────────────────
const WhatsAppSetupPage: React.FC = () => {
  const [wizardStep, setWizardStep] = useState(1);
  const [showWizard, setShowWizard] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editProfile, setEditProfile] = useState<any>(null);
  const [profileForm, setProfileForm] = useState({ about: '', address: '', description: '', email: '', websites: '' });

  const [form, setForm] = useState({
    name: '',
    phoneNumber: '',
    phoneNumberId: '',
    businessAccountId: '',
    accessToken: '',
    webhookVerifyToken: 'crm_verify_' + Math.random().toString(36).slice(2, 10),
    apiType: 'CLOUD',
  });

  const qc = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['wa-accounts'],
    queryFn: () => whatsappApi.accounts().then(r => r.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => whatsappApi.templates().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: whatsappApi.createAccount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-accounts'] });
      toast.success('Account saved! Now verify the connection →');
      setWizardStep(3);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/accounts/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['wa-accounts'] }); toast.success('Account removed'); },
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.post(`/whatsapp/accounts/${id}/profile`, data),
    onSuccess: () => { toast.success('Business profile updated on WhatsApp!'); setEditProfile(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Update failed'),
  });

  const handleVerify = async (accountId: string) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data } = await api.post(`/whatsapp/accounts/${accountId}/verify`);
      setVerifyResult({ ok: true, ...data });
      qc.invalidateQueries({ queryKey: ['wa-accounts'] });
      toast.success('Connection verified! ✅');
    } catch (e: any) {
      const msg = e.response?.data?.error || 'Verification failed';
      setVerifyResult({ ok: false, error: msg });
      toast.error(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncTemplates = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const { data } = await api.post(`/whatsapp/accounts/${accountId}/templates/sync`);
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success(`Synced ${data.synced} templates from Meta`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleSaveCredentials = () => {
    if (!form.name || !form.phoneNumber || !form.phoneNumberId || !form.businessAccountId || !form.accessToken) {
      toast.error('All fields are required');
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Integration</h1>
          <p className="text-gray-500 text-sm mt-1">Connect your Meta Business WhatsApp number to the CRM</p>
        </div>
        <button
          onClick={() => { setShowWizard(true); setWizardStep(1); setVerifyResult(null); }}
          className="btn-primary"
        >
          + Connect Number
        </button>
      </div>

      {/* Connected accounts */}
      {!isLoading && (accounts || []).length > 0 && (
        <div className="space-y-4 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Connected Numbers</h2>
          {(accounts || []).map((acc: any) => (
            <div key={acc.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-whatsapp-green rounded-xl flex items-center justify-center">
                    <PhoneIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">{acc.name}</h3>
                      {acc.isGreenTick && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <ShieldCheckIcon className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                      <StatusBadge status={acc.status} />
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{acc.phoneNumber}</p>
                    <div className="flex gap-3 mt-1 text-xs text-gray-400">
                      <span>Phone ID: <code className="bg-gray-100 px-1 rounded">{acc.phoneNumberId}</code></span>
                      {acc.qualityRating && <span>Quality: <strong className="text-gray-700">{acc.qualityRating}</strong></span>}
                      {acc.messagingLimit && <span>Limit: {acc.messagingLimit}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVerify(acc.id)}
                    disabled={verifying}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                  >
                    {verifying ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ArrowPathIcon className="w-3.5 h-3.5" />}
                    Test Connection
                  </button>
                  <button
                    onClick={() => handleSyncTemplates(acc.id)}
                    disabled={syncing === acc.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                  >
                    {syncing === acc.id ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <ArrowDownTrayIcon className="w-3.5 h-3.5" />}
                    Sync Templates
                  </button>
                  <button
                    onClick={() => {
                      setEditProfile(acc);
                      setProfileForm({ about: acc.about || '', address: '', description: '', email: '', websites: '' });
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Edit Business Profile"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(acc.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove Account"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Verify result inline */}
              {verifyResult && (
                <div className={`mt-4 p-3 rounded-xl border text-sm ${verifyResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  {verifyResult.ok ? (
                    <div className="flex items-start gap-2 text-green-800">
                      <CheckCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Connection successful!</p>
                        <p className="text-xs mt-1">Display name: <strong>{verifyResult.phoneInfo?.verified_name}</strong> · Quality: <strong>{verifyResult.phoneInfo?.quality_rating}</strong></p>
                        {verifyResult.profile?.about && <p className="text-xs">About: {verifyResult.profile.about}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-red-800">
                      <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Verification failed</p>
                        <p className="text-xs mt-1">{verifyResult.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Webhook URL */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 font-medium">Webhook URL (paste in Meta Developer Console)</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <code className="flex-1 text-xs text-gray-700 break-all">{WEBHOOK_URL}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(WEBHOOK_URL); toast.success('Copied!'); }}
                    className="text-gray-400 hover:text-whatsapp-teal flex-shrink-0"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-500">Verify token:</span>
                  <code className="flex-1 text-xs text-gray-700">{acc.webhookVerifyToken}</code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(acc.webhookVerifyToken); toast.success('Copied!'); }}
                    className="text-gray-400 hover:text-whatsapp-teal flex-shrink-0"
                  >
                    <ClipboardDocumentIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Templates overview */}
      {(templates || []).length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Message Templates ({(templates || []).length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Category</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Language</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 uppercase px-3 py-2 max-w-xs">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(templates || []).map((t: any) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{t.name}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{t.category}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{t.language}</td>
                    <td className="px-3 py-2">
                      <span className={`badge text-xs ${
                        t.status === 'APPROVED' ? 'badge-green' :
                        t.status === 'REJECTED' ? 'badge-red' :
                        t.status === 'PAUSED' ? 'badge-yellow' : 'badge-blue'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate">{t.body}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (accounts || []).length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-20 h-20 bg-whatsapp-green/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <PhoneIcon className="w-10 h-10 text-whatsapp-teal" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">No WhatsApp number connected</h3>
          <p className="text-gray-500 text-sm mt-2 mb-6 max-w-md mx-auto">
            Connect your WhatsApp Business number via the Meta Cloud API to start sending and receiving messages in the CRM.
          </p>
          <button onClick={() => { setShowWizard(true); setWizardStep(1); }} className="btn-primary">
            Connect WhatsApp Number
          </button>
        </div>
      )}

      {/* ─── Edit Business Profile Modal ────────────────────────────────── */}
      {editProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Business Profile</h2>
              <button onClick={() => setEditProfile(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">About / Status</label>
                <input className="input-field" maxLength={139} placeholder="About your business..." value={profileForm.about} onChange={e => setProfileForm({ ...profileForm, about: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">{profileForm.about.length}/139</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field" rows={3} value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                <input type="email" className="input-field" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input className="input-field" value={profileForm.address} onChange={e => setProfileForm({ ...profileForm, address: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input className="input-field" placeholder="https://example.com" value={profileForm.websites} onChange={e => setProfileForm({ ...profileForm, websites: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditProfile(null)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => updateProfileMutation.mutate({
                    id: editProfile.id,
                    data: {
                      about: profileForm.about,
                      description: profileForm.description,
                      email: profileForm.email,
                      address: profileForm.address,
                      websites: profileForm.websites ? [profileForm.websites] : undefined,
                    },
                  })}
                  className="btn-primary flex-1"
                >
                  Save to WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Setup Wizard Modal ──────────────────────────────────────────── */}
      {showWizard && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Wizard header */}
            <div className="px-6 pt-6 pb-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Connect WhatsApp</h2>
                <button onClick={() => setShowWizard(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              {/* Step progress */}
              <div className="flex items-center">
                {steps.map((s, i) => (
                  <React.Fragment key={s.id}>
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all
                        ${wizardStep > s.id ? 'bg-whatsapp-green border-whatsapp-green text-white' :
                          wizardStep === s.id ? 'border-whatsapp-green text-whatsapp-teal bg-white' :
                          'border-gray-300 text-gray-400 bg-white'}`}>
                        {wizardStep > s.id ? '✓' : s.id}
                      </div>
                      <span className={`text-xs mt-1 font-medium ${wizardStep === s.id ? 'text-whatsapp-teal' : 'text-gray-400'}`}>
                        {s.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 mb-5 transition-all ${wizardStep > s.id ? 'bg-whatsapp-green' : 'bg-gray-200'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="p-6">
              {/* ── Step 1: Meta App prerequisites ── */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Before you start</h3>
                    <p className="text-sm text-gray-500">Make sure you have the following ready in Meta Business Manager:</p>
                  </div>
                  {[
                    { n: '1', title: 'Meta Business Account', desc: 'Go to business.facebook.com and verify your business identity.' },
                    { n: '2', title: 'Meta Developer App', desc: 'Create an App at developers.facebook.com with the WhatsApp product added.' },
                    { n: '3', title: 'WhatsApp Business Account (WABA)', desc: 'Create a WABA inside the App settings. Note your Business Account ID.' },
                    { n: '4', title: 'Phone Number', desc: 'Add and verify a phone number inside your WABA. Note the Phone Number ID.' },
                    { n: '5', title: 'Permanent Access Token', desc: 'Create a System User in Business Settings → Users → System Users with full permissions, then generate a token.' },
                  ].map(item => (
                    <div key={item.n} className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl">
                      <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {item.n}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-600 mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                  <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                    <LinkIcon className="w-4 h-4" />
                    Official Meta Cloud API setup guide →
                  </a>
                </div>
              )}

              {/* ── Step 2: Credentials ── */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Enter your credentials</h3>
                    <p className="text-sm text-gray-500">These come from your Meta Developer App dashboard.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Nickname <span className="text-red-500">*</span></label>
                    <input className="input-field" placeholder="e.g. Main Support Line" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number <span className="text-red-500">*</span>
                      <span className="ml-1 text-xs text-gray-400 font-normal">(with country code)</span>
                    </label>
                    <input className="input-field" placeholder="+1 415 555 1234" value={form.phoneNumber} onChange={e => setForm({ ...form, phoneNumber: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number ID <span className="text-red-500">*</span>
                      <span className="ml-1 text-xs text-gray-400 font-normal">(from Meta App → WhatsApp → Getting Started)</span>
                    </label>
                    <input className="input-field" placeholder="123456789012345" value={form.phoneNumberId} onChange={e => setForm({ ...form, phoneNumberId: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp Business Account ID <span className="text-red-500">*</span>
                    </label>
                    <input className="input-field" placeholder="987654321098765" value={form.businessAccountId} onChange={e => setForm({ ...form, businessAccountId: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Permanent Access Token <span className="text-red-500">*</span>
                      <span className="ml-1 text-xs text-gray-400 font-normal">(System User token from Business Settings)</span>
                    </label>
                    <textarea
                      className="input-field font-mono text-xs"
                      rows={3}
                      placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx..."
                      value={form.accessToken}
                      onChange={e => setForm({ ...form, accessToken: e.target.value.trim() })}
                    />
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                    <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
                    Never share your access token publicly. It is stored securely in your database.
                  </div>
                </div>
              )}

              {/* ── Step 3: Verify ── */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Test your connection</h3>
                    <p className="text-sm text-gray-500">We'll call the Meta API to confirm your credentials are valid.</p>
                  </div>
                  {(accounts || []).length > 0 && (
                    <div className="space-y-3">
                      {(accounts || []).map((acc: any) => (
                        <div key={acc.id} className="border border-gray-200 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="font-medium text-gray-900">{acc.name}</p>
                              <p className="text-xs text-gray-500">{acc.phoneNumber}</p>
                            </div>
                            <StatusBadge status={acc.status} />
                          </div>
                          <button
                            onClick={() => handleVerify(acc.id)}
                            disabled={verifying}
                            className="w-full flex items-center justify-center gap-2 py-2 bg-whatsapp-green text-white text-sm font-medium rounded-xl hover:bg-whatsapp-teal transition-colors disabled:opacity-60"
                          >
                            {verifying ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowPathIcon className="w-4 h-4" />}
                            {verifying ? 'Verifying with Meta...' : 'Verify Connection'}
                          </button>
                          {verifyResult && (
                            <div className={`mt-3 p-3 rounded-xl ${verifyResult.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                              {verifyResult.ok ? (
                                <div className="flex items-center gap-2 text-green-700 text-sm">
                                  <CheckSolid className="w-5 h-5" />
                                  <div>
                                    <p className="font-semibold">Connected! ✅</p>
                                    <p className="text-xs mt-0.5">
                                      {verifyResult.phoneInfo?.verified_name} · Quality: {verifyResult.phoneInfo?.quality_rating}
                                      {verifyResult.account?.isGreenTick ? ' · ✅ Green Tick Verified' : ''}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-red-700 text-sm">
                                  <XCircleIcon className="w-5 h-5" />
                                  <div>
                                    <p className="font-semibold">Failed</p>
                                    <p className="text-xs mt-0.5">{verifyResult.error}</p>
                                    <p className="text-xs mt-1 text-red-600">Check your Phone Number ID and Access Token in Step 2.</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 4: Webhook ── */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Configure Webhook</h3>
                    <p className="text-sm text-gray-500">
                      Webhooks allow Meta to push incoming messages and status updates to this CRM in real time.
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <p className="text-sm font-semibold text-blue-900">In your Meta App → WhatsApp → Configuration → Webhook, paste these:</p>
                    <CopyField label="Webhook URL" value={WEBHOOK_URL} />
                    <CopyField
                      label="Verify Token"
                      value={(accounts || [])[0]?.webhookVerifyToken || form.webhookVerifyToken}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">Subscribe to these Webhook Fields:</p>
                    {['messages', 'message_deliveries', 'message_reads', 'messaging_postbacks'].map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckSolid className="w-4 h-4 text-green-500" />
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{f}</code>
                      </div>
                    ))}
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1">
                    <p className="font-semibold text-gray-800">Step-by-step:</p>
                    <p>1. Go to <strong>developers.facebook.com</strong> → your App → WhatsApp → Configuration</p>
                    <p>2. Under <strong>Webhook</strong>, click <em>Edit</em></p>
                    <p>3. Paste the Webhook URL and Verify Token above</p>
                    <p>4. Click <strong>Verify and Save</strong></p>
                    <p>5. Click <strong>Manage</strong> and subscribe to all fields listed above</p>
                  </div>
                </div>
              )}

              {/* ── Step 5: Business Profile ── */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">Business Profile (optional)</h3>
                    <p className="text-sm text-gray-500">Set up what customers see when they open your WhatsApp profile.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">About / Status</label>
                    <input className="input-field" maxLength={139} placeholder="e.g. Official customer support for Acme Corp"
                      value={profileForm.about} onChange={e => setProfileForm({ ...profileForm, about: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Description</label>
                    <textarea className="input-field" rows={3} value={profileForm.description} onChange={e => setProfileForm({ ...profileForm, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Email</label>
                    <input type="email" className="input-field" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                    <input className="input-field" placeholder="https://yoursite.com" value={profileForm.websites} onChange={e => setProfileForm({ ...profileForm, websites: e.target.value })} />
                  </div>

                  {(accounts || []).length > 0 && profileForm.about && (
                    <button
                      onClick={() => updateProfileMutation.mutate({
                        id: (accounts || [])[0]?.id,
                        data: { about: profileForm.about, description: profileForm.description, email: profileForm.email, websites: profileForm.websites ? [profileForm.websites] : undefined },
                      })}
                      className="w-full btn-primary justify-center"
                    >
                      Save Profile to WhatsApp
                    </button>
                  )}

                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                    <CheckSolid className="w-10 h-10 text-green-500 mx-auto mb-2" />
                    <p className="font-semibold text-green-800">Setup complete!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Your WhatsApp number is now connected. Go to the <strong>Inbox</strong> to start receiving messages.
                    </p>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-6 mt-4 border-t border-gray-200">
                {wizardStep > 1 && (
                  <button onClick={() => setWizardStep(s => s - 1)} className="btn-secondary flex items-center gap-2">
                    <ChevronLeftIcon className="w-4 h-4" /> Back
                  </button>
                )}
                {wizardStep === 2 && (
                  <button
                    onClick={handleSaveCredentials}
                    disabled={createMutation.isPending}
                    className="btn-primary flex-1 justify-center"
                  >
                    {createMutation.isPending ? 'Saving...' : 'Save & Continue →'}
                  </button>
                )}
                {wizardStep !== 2 && wizardStep < steps.length && (
                  <button onClick={() => setWizardStep(s => s + 1)} className="btn-primary flex-1 justify-center flex items-center gap-2">
                    Continue <ChevronRightIcon className="w-4 h-4" />
                  </button>
                )}
                {wizardStep === steps.length && (
                  <button onClick={() => setShowWizard(false)} className="btn-primary flex-1 justify-center">
                    Done — Go to Inbox →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppSetupPage;
