import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, MagnifyingGlassIcon, SparklesIcon, ArrowPathIcon,
  PencilIcon, TrashIcon, ArrowRightIcon, FunnelIcon,
} from '@heroicons/react/24/outline';
import { leadsApi, aiApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  NEW: 'badge-blue',
  CONTACTED: 'badge-purple',
  QUALIFIED: 'badge-green',
  UNQUALIFIED: 'badge-red',
  CONVERTED: 'badge-gray',
  LOST: 'badge-red',
};

const ScoreBar: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400'}`}
        style={{ width: `${score}%` }}
      />
    </div>
    <span className="text-xs font-medium text-gray-700">{score}</span>
  </div>
);

const LeadModal: React.FC<{ lead?: any; onClose: () => void; onSave: (data: any) => void }> = ({ lead, onClose, onSave }) => {
  const [form, setForm] = useState({
    title: lead?.title || '',
    source: lead?.source || 'MANUAL',
    status: lead?.status || 'NEW',
    budget: lead?.budget || '',
    notes: lead?.notes || '',
    utmSource: lead?.utmSource || '',
    utmCampaign: lead?.utmCampaign || '',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{lead ? 'Edit Lead' : 'Add Lead'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input required className="input-field" placeholder="Lead title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select className="input-field" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
                {['MANUAL', 'WEB_FORM', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK_ADS', 'CLICK_TO_WHATSAPP'].map(s => (
                  <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input-field" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
            <input type="number" className="input-field" placeholder="0" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UTM Source</label>
              <input className="input-field" placeholder="google" value={form.utmSource} onChange={e => setForm({ ...form, utmSource: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UTM Campaign</label>
              <input className="input-field" placeholder="summer-sale" value={form.utmCampaign} onChange={e => setForm({ ...form, utmCampaign: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={() => onSave(form)} className="btn-primary flex-1">Save Lead</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeadsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState<'table' | 'kanban'>('table');
  const [showModal, setShowModal] = useState(false);
  const [editLead, setEditLead] = useState<any>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => leadsApi.list({ search, status: statusFilter }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setShowModal(false); toast.success('Lead created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => leadsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leads'] }); setEditLead(null); toast.success('Lead updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: leadsApi.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
  });

  const handleAIScore = async (leadId: string) => {
    try {
      const { data } = await aiApi.scoreLeadAI(leadId);
      toast.success(`AI Score: ${data.score}/100 — ${data.nextAction}`);
      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      toast.error('AI scoring unavailable');
    }
  };

  const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST'];

  return (
    <div className="p-6">
      {(showModal || editLead) && (
        <LeadModal
          lead={editLead}
          onClose={() => { setShowModal(false); setEditLead(null); }}
          onSave={(formData) => editLead ? updateMutation.mutate({ id: editLead.id, data: formData }) : createMutation.mutate(formData)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} total leads</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('table')} className={`px-3 py-1 text-xs rounded-md transition-colors ${view === 'table' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Table</button>
            <button onClick={() => setView('kanban')} className={`px-3 py-1 text-xs rounded-md transition-colors ${view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Kanban</button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search leads..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {view === 'table' ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Lead</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Score</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Source</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Budget</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Assignee</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Created</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.data || []).map((lead: any) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.contact ? `${lead.contact.firstName} ${lead.contact.lastName || ''}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${statusColors[lead.status]}`}>{lead.status}</span>
                  </td>
                  <td className="px-4 py-3"><ScoreBar score={lead.score} /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{lead.source?.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-700">{lead.budget ? `$${Number(lead.budget).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {lead.assignee ? `${lead.assignee.firstName} ${lead.assignee.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(lead.createdAt), 'MMM d')}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => handleAIScore(lead.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="AI Score">
                        <SparklesIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditLead(lead)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Convert to Deal">
                        <ArrowRightIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Kanban View */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUSES.slice(0, 4).map(status => {
            const statusLeads = (data?.data || []).filter((l: any) => l.status === status);
            return (
              <div key={status} className="flex-shrink-0 w-72 bg-gray-100 rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-800">{status}</h3>
                  <span className="text-xs bg-white text-gray-600 px-2 py-0.5 rounded-full border">{statusLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {statusLeads.map((lead: any) => (
                    <div key={lead.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                      <p className="text-sm font-medium text-gray-900 mb-1">{lead.title}</p>
                      {lead.contact && (
                        <p className="text-xs text-gray-500 mb-2">{lead.contact.firstName} {lead.contact.lastName}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <ScoreBar score={lead.score} />
                        {lead.budget && <span className="text-xs font-medium text-emerald-600">${Number(lead.budget).toLocaleString()}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LeadsPage;
