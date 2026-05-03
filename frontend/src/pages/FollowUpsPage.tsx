import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
  TrashIcon, PaperAirplaneIcon, BellIcon, ArrowPathIcon,
  CalendarIcon, PhoneIcon,
} from '@heroicons/react/24/outline';
import { api } from '../services/api';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  PENDING: { color: 'badge-yellow', icon: ClockIcon, label: 'Scheduled' },
  SENT: { color: 'badge-green', icon: CheckCircleIcon, label: 'Sent' },
  FAILED: { color: 'badge-red', icon: XCircleIcon, label: 'Failed' },
  CANCELLED: { color: 'badge-gray', icon: XCircleIcon, label: 'Cancelled' },
};

const FollowUpsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [form, setForm] = useState({
    title: '',
    message: '',
    scheduledAt: '',
    contactId: '',
    conversationId: '',
    type: 'MANUAL',
    recurringDays: '',
    notes: '',
  });
  const qc = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ['follow-ups', statusFilter],
    queryFn: () => api.get('/follow-ups', { params: { status: statusFilter || undefined } }).then(r => r.data),
    refetchInterval: 30000,
  });

  const { data: contacts } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: () => api.get('/contacts', { params: { limit: 200 } }).then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/follow-ups', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['follow-ups'] });
      setShowModal(false);
      setForm({ title: '', message: '', scheduledAt: '', contactId: '', conversationId: '', type: 'MANUAL', recurringDays: '', notes: '' });
      toast.success('Follow-up scheduled! Message will be sent automatically.');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Failed'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/follow-ups/${id}/cancel`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Cancelled'); },
  });

  const sendNowMutation = useMutation({
    mutationFn: (id: string) => api.post(`/follow-ups/${id}/send-now`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Sending now...'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/follow-ups/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['follow-ups'] }); toast.success('Deleted'); },
  });

  const pending = (followUps || []).filter((f: any) => f.status === 'PENDING').length;
  const sent = (followUps || []).filter((f: any) => f.status === 'SENT').length;

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold">Schedule Follow-up</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title / Label</label>
                <input className="input-field" placeholder="e.g. Check if interested" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message to Send *</label>
                <textarea className="input-field" rows={4}
                  placeholder="Hi {{name}}, just following up on our conversation. Would you like to proceed?"
                  value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">This exact message will be sent via WhatsApp</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact *</label>
                <select className="input-field" value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })}>
                  <option value="">Select contact...</option>
                  {(contacts || []).map((c: any) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName || ''} — {c.phone}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Send Date & Time *</label>
                <input type="datetime-local" className="input-field" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  <option value="MANUAL">One-time</option>
                  <option value="AUTO">Automated</option>
                  <option value="RECURRING">Recurring</option>
                </select>
              </div>

              {form.type === 'RECURRING' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Repeat every (days)</label>
                  <input type="number" min="1" className="input-field" placeholder="7" value={form.recurringDays} onChange={e => setForm({ ...form, recurringDays: e.target.value })} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes (optional)</label>
                <input className="input-field" placeholder="Reason for follow-up..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => createMutation.mutate({ ...form, recurringDays: form.recurringDays ? Number(form.recurringDays) : undefined })}
                  disabled={!form.message || !form.scheduledAt || !form.contactId || createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Scheduling...' : '📅 Schedule Follow-up'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Follow-ups</h1>
          <p className="text-gray-500 text-sm mt-1">Schedule automatic WhatsApp messages to clients</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          Schedule Follow-up
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Scheduled', value: (followUps || []).filter((f: any) => f.status === 'PENDING').length, color: 'bg-yellow-500', icon: ClockIcon },
          { label: 'Sent Today', value: (followUps || []).filter((f: any) => f.status === 'SENT' && new Date(f.sentAt).toDateString() === new Date().toDateString()).length, color: 'bg-green-500', icon: CheckCircleIcon },
          { label: 'Total Sent', value: (followUps || []).filter((f: any) => f.status === 'SENT').length, color: 'bg-blue-500', icon: PaperAirplaneIcon },
          { label: 'Recurring', value: (followUps || []).filter((f: any) => f.type === 'RECURRING' && f.status === 'PENDING').length, color: 'bg-purple-500', icon: ArrowPathIcon },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-5">
        {[
          { key: '', label: 'All' },
          { key: 'PENDING', label: '⏰ Scheduled' },
          { key: 'SENT', label: '✅ Sent' },
          { key: 'FAILED', label: '❌ Failed' },
          { key: 'CANCELLED', label: '🚫 Cancelled' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-2 text-sm rounded-xl font-medium transition-colors ${statusFilter === tab.key ? 'bg-whatsapp-green text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Follow-ups List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (followUps || []).length === 0 ? (
        <div className="card p-12 text-center">
          <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No follow-ups yet</h3>
          <p className="text-gray-400 text-sm mt-1 mb-4">Schedule automatic WhatsApp messages to follow up with clients</p>
          <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">Schedule First Follow-up</button>
        </div>
      ) : (
        <div className="space-y-3">
          {(followUps || []).map((fu: any) => {
            const StatusIcon = statusConfig[fu.status]?.icon || ClockIcon;
            const isOverdue = fu.status === 'PENDING' && new Date(fu.scheduledAt) < new Date();
            return (
              <div key={fu.id} className={`card p-5 ${isOverdue ? 'border-orange-200 bg-orange-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${fu.status === 'PENDING' ? 'bg-yellow-100' : fu.status === 'SENT' ? 'bg-green-100' : 'bg-red-100'}`}>
                      <StatusIcon className={`w-5 h-5 ${fu.status === 'PENDING' ? 'text-yellow-600' : fu.status === 'SENT' ? 'text-green-600' : 'text-red-600'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{fu.title || 'Follow-up'}</h3>
                        <span className={`badge ${statusConfig[fu.status]?.color}`}>{statusConfig[fu.status]?.label}</span>
                        {fu.type === 'RECURRING' && <span className="badge badge-purple text-xs">🔄 Recurring every {fu.recurringDays}d</span>}
                        {isOverdue && <span className="badge badge-red text-xs">⚠️ Overdue</span>}
                      </div>

                      <div className="bg-whatsapp-light rounded-xl px-3 py-2 mb-2 max-w-lg">
                        <p className="text-sm text-gray-800">{fu.message}</p>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {fu.contact && (
                          <span className="flex items-center gap-1">
                            <PhoneIcon className="w-3 h-3" />
                            {fu.contact.firstName} {fu.contact.lastName || ''} — {fu.contact.phone}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {fu.status === 'SENT'
                            ? `Sent ${formatDistanceToNow(new Date(fu.sentAt), { addSuffix: true })}`
                            : `Scheduled: ${format(new Date(fu.scheduledAt), 'MMM d, yyyy HH:mm')}`
                          }
                        </span>
                        {fu.createdBy && <span>By: {fu.createdBy.firstName}</span>}
                        {fu.notes && <span>Note: {fu.notes}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {fu.status === 'PENDING' && (
                      <>
                        <button onClick={() => sendNowMutation.mutate(fu.id)} disabled={sendNowMutation.isPending}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-white bg-whatsapp-green rounded-lg hover:bg-whatsapp-teal">
                          <PaperAirplaneIcon className="w-3.5 h-3.5" /> Send Now
                        </button>
                        <button onClick={() => cancelMutation.mutate(fu.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                          Cancel
                        </button>
                      </>
                    )}
                    <button onClick={() => deleteMutation.mutate(fu.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FollowUpsPage;
