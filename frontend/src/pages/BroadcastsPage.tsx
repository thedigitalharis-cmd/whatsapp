import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, PlayIcon, PauseIcon, ChartBarIcon,
  MegaphoneIcon, ClockIcon, CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline';
import { broadcastsApi, whatsappApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  DRAFT: { color: 'badge-gray', icon: ClockIcon },
  SCHEDULED: { color: 'badge-blue', icon: ClockIcon },
  RUNNING: { color: 'badge-yellow', icon: PlayIcon },
  PAUSED: { color: 'badge-yellow', icon: PauseIcon },
  COMPLETED: { color: 'badge-green', icon: CheckCircleIcon },
  FAILED: { color: 'badge-red', icon: XCircleIcon },
};

const BroadcastsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    whatsappAccountId: '',
    templateId: '',
    scheduledAt: '',
  });
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: () => broadcastsApi.list().then(r => r.data),
  });

  const { data: accounts } = useQuery({
    queryKey: ['wa-accounts'],
    queryFn: () => whatsappApi.accounts().then(r => r.data),
  });

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => whatsappApi.templates().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: broadcastsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts'] }); setShowModal(false); toast.success('Broadcast created'); },
  });

  const launchMutation = useMutation({
    mutationFn: broadcastsApi.launch,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts'] }); toast.success('Broadcast launched!'); },
  });

  const pauseMutation = useMutation({
    mutationFn: broadcastsApi.pause,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['broadcasts'] }); toast.success('Broadcast paused'); },
  });

  const { data: stats } = useQuery({
    queryKey: ['broadcast-stats', selectedBroadcast?.id],
    queryFn: () => selectedBroadcast ? broadcastsApi.stats(selectedBroadcast.id).then(r => r.data) : null,
    enabled: !!selectedBroadcast,
  });

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Broadcast</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Broadcast Name *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Account</label>
                <select className="input-field" value={form.whatsappAccountId} onChange={e => setForm({ ...form, whatsappAccountId: e.target.value })}>
                  <option value="">Select account...</option>
                  {(accounts || []).map((acc: any) => <option key={acc.id} value={acc.id}>{acc.name} ({acc.phoneNumber})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message Template</label>
                <select className="input-field" value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}>
                  <option value="">Select template...</option>
                  {(templates || []).filter((t: any) => t.status === 'APPROVED').map((t: any) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Schedule (optional)</label>
                <input type="datetime-local" className="input-field" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} className="btn-primary flex-1">Create Broadcast</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcasts</h1>
          <p className="text-gray-500 text-sm mt-1">Send bulk messages to your contacts</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Broadcast
        </button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Broadcasts', value: data?.total || 0, color: 'bg-blue-500' },
          { label: 'Running', value: (data?.data || []).filter((b: any) => b.status === 'RUNNING').length, color: 'bg-yellow-500' },
          { label: 'Completed', value: (data?.data || []).filter((b: any) => b.status === 'COMPLETED').length, color: 'bg-green-500' },
          { label: 'Scheduled', value: (data?.data || []).filter((b: any) => b.status === 'SCHEDULED').length, color: 'bg-indigo-500' },
        ].map(item => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
              <MegaphoneIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-xl font-bold text-gray-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Broadcasts List */}
      <div className="space-y-4">
        {(data?.data || []).map((broadcast: any) => {
          const StatusIcon = statusConfig[broadcast.status]?.icon || ClockIcon;
          return (
            <div key={broadcast.id} className="card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">{broadcast.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {broadcast.whatsappAccount?.name} •
                    {broadcast.scheduledAt ? ` Scheduled: ${format(new Date(broadcast.scheduledAt), 'MMM d, HH:mm')}` : ' Immediate'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${statusConfig[broadcast.status]?.color}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {broadcast.status}
                  </span>
                  {(broadcast.status === 'DRAFT' || broadcast.status === 'SCHEDULED') && (
                    <button
                      onClick={() => launchMutation.mutate(broadcast.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-whatsapp-green rounded-lg hover:bg-whatsapp-teal"
                    >
                      <PlayIcon className="w-3.5 h-3.5" />
                      Launch
                    </button>
                  )}
                  {broadcast.status === 'RUNNING' && (
                    <button
                      onClick={() => pauseMutation.mutate(broadcast.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                    >
                      <PauseIcon className="w-3.5 h-3.5" />
                      Pause
                    </button>
                  )}
                  <button onClick={() => setSelectedBroadcast(broadcast)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg">
                    <ChartBarIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress */}
              {broadcast.totalRecipients > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{broadcast.sentCount} / {broadcast.totalRecipients} sent</span>
                    <span>{broadcast.readCount} read ({broadcast.totalRecipients ? Math.round(broadcast.readCount / broadcast.totalRecipients * 100) : 0}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-whatsapp-green h-2 rounded-full transition-all"
                      style={{ width: `${broadcast.totalRecipients ? (broadcast.sentCount / broadcast.totalRecipients * 100) : 0}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-3 mt-3">
                    {[
                      { label: 'Sent', value: broadcast.sentCount, color: 'text-blue-600' },
                      { label: 'Delivered', value: broadcast.deliveredCount, color: 'text-green-600' },
                      { label: 'Read', value: broadcast.readCount, color: 'text-whatsapp-teal' },
                      { label: 'Failed', value: broadcast.failedCount, color: 'text-red-600' },
                    ].map(stat => (
                      <div key={stat.label} className="text-center p-2 bg-gray-50 rounded-lg">
                        <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BroadcastsPage;
