import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, TrashIcon, PlayIcon, PauseIcon } from '@heroicons/react/24/outline';
import { campaignsApi } from '../services/api';
import toast from 'react-hot-toast';

const CampaignsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', type: 'DRIP', triggerEvent: 'contact_created' });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['campaigns'], queryFn: () => campaignsApi.list().then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); setShowModal(false); toast.success('Campaign created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: campaignsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['campaigns'] }); toast.success('Deleted'); },
  });

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Campaign</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['DRIP', 'TRIGGER', 'BROADCAST'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {form.type === 'TRIGGER' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trigger Event</label>
                  <select className="input-field" value={form.triggerEvent} onChange={e => setForm({ ...form, triggerEvent: e.target.value })}>
                    {['contact_created', 'lead_status_changed', 'deal_won', 'ticket_created', 'order_placed'].map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} className="btn-primary flex-1">Create Campaign</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="text-gray-500 text-sm mt-1">Drip sequences & trigger campaigns</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data || []).map((campaign: any) => (
          <div key={campaign.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{campaign.type}</span>
                <h3 className="text-sm font-semibold text-gray-900 mt-2">{campaign.name}</h3>
              </div>
              <span className={`badge ${campaign.status === 'ACTIVE' ? 'badge-green' : campaign.status === 'PAUSED' ? 'badge-yellow' : 'badge-gray'}`}>
                {campaign.status}
              </span>
            </div>
            {campaign.description && <p className="text-xs text-gray-500 mb-3">{campaign.description}</p>}
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
              <span>{campaign.steps?.length || 0} steps</span>
              {campaign.triggerEvent && <span>• Trigger: {campaign.triggerEvent.replace(/_/g, ' ')}</span>}
            </div>
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <button className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 flex-1 justify-center">
                <PlayIcon className="w-3.5 h-3.5" />
                Activate
              </button>
              <button onClick={() => deleteMutation.mutate(campaign.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CampaignsPage;
