import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilIcon, TrashIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { dealsApi, pipelinesApi } from '../services/api';
import toast from 'react-hot-toast';

const dealStatusColors: Record<string, string> = {
  OPEN: 'text-blue-600 bg-blue-50',
  WON: 'text-green-600 bg-green-50',
  LOST: 'text-red-600 bg-red-50',
  ON_HOLD: 'text-yellow-600 bg-yellow-50',
};

const DealsPage: React.FC = () => {
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', value: '', stageId: '', probability: 50 });
  const qc = useQueryClient();

  const { data: pipelines } = useQuery({
    queryKey: ['pipelines'],
    queryFn: () => pipelinesApi.list().then(r => r.data),
  });

  const { data: deals } = useQuery({
    queryKey: ['deals'],
    queryFn: () => dealsApi.list({ limit: 200 }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: dealsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); setShowModal(false); toast.success('Deal created'); },
  });

  const updateStageMutation = useMutation({
    mutationFn: ({ dealId, stageId }: any) => dealsApi.updateStage(dealId, stageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: dealsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deals'] }); toast.success('Deal deleted'); },
  });

  const pipeline = pipelines?.[0];
  const stages = pipeline?.stages || [];

  const totalRevenue = (deals?.data || []).filter((d: any) => d.status === 'WON').reduce((s: number, d: any) => s + d.value, 0);
  const pipelineValue = (deals?.data || []).filter((d: any) => d.status === 'OPEN').reduce((s: number, d: any) => s + d.value, 0);

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Deal</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deal Title *</label>
                <input required className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value ($)</label>
                  <input type="number" className="input-field" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Probability (%)</label>
                  <input type="number" min={0} max={100} className="input-field" value={form.probability} onChange={e => setForm({ ...form, probability: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pipeline Stage</label>
                <select className="input-field" value={form.stageId} onChange={e => setForm({ ...form, stageId: e.target.value })}>
                  <option value="">Select stage...</option>
                  {stages.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button
                  onClick={() => createMutation.mutate({ ...form, value: Number(form.value) || 0 })}
                  disabled={!form.title || !form.stageId}
                  className="btn-primary flex-1"
                >
                  Create Deal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-gray-500 text-sm mt-1">{deals?.total || 0} total deals</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button onClick={() => setView('kanban')} className={`px-3 py-1 text-xs rounded-md ${view === 'kanban' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>Kanban</button>
            <button onClick={() => setView('list')} className={`px-3 py-1 text-xs rounded-md ${view === 'list' ? 'bg-white shadow-sm' : 'text-gray-500'}`}>List</button>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" />
            Add Deal
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, color: 'bg-blue-500' },
          { label: 'Won Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'bg-green-500' },
          { label: 'Open Deals', value: (deals?.data || []).filter((d: any) => d.status === 'OPEN').length, color: 'bg-indigo-500' },
          { label: 'Won Deals', value: (deals?.data || []).filter((d: any) => d.status === 'WON').length, color: 'bg-emerald-500' },
        ].map(item => (
          <div key={item.label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center`}>
              <CurrencyDollarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-lg font-bold text-gray-900">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      {view === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {stages.map((stage: any) => {
            const stageDeals = (deals?.data || []).filter((d: any) => d.stageId === stage.id);
            const stageValue = stageDeals.reduce((s: number, d: any) => s + (d.value || 0), 0);
            return (
              <div key={stage.id} className="flex-shrink-0 w-72 bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color || '#25D366' }} />
                    <h3 className="text-sm font-semibold text-gray-800">{stage.name}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-white text-gray-600 px-1.5 py-0.5 rounded-full border">{stageDeals.length}</span>
                    <p className="text-xs text-gray-500 mt-0.5">${stageValue.toLocaleString()}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {stageDeals.map((deal: any) => (
                    <div key={deal.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200 hover:shadow-md transition-shadow group">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 leading-tight">{deal.title}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-0.5 text-gray-400 hover:text-blue-600">
                            <PencilIcon className="w-3 h-3" />
                          </button>
                          <button onClick={() => deleteMutation.mutate(deal.id)} className="p-0.5 text-gray-400 hover:text-red-600">
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {deal.contact && (
                        <p className="text-xs text-gray-500 mb-2">{deal.contact.firstName} {deal.contact.lastName}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${deal.value > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          ${(deal.value || 0).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1 bg-gray-200 rounded-full">
                            <div className="h-1 bg-blue-500 rounded-full" style={{ width: `${deal.probability}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{deal.probability}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Deal</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Contact</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Stage</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Value</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Probability</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(deals?.data || []).map((deal: any) => (
                <tr key={deal.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{deal.title}</td>
                  <td className="px-4 py-3 text-gray-600">{deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName || ''}` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: deal.stage?.color || '#ccc' }} />
                      {deal.stage?.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">${(deal.value || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-600">{deal.probability}%</td>
                  <td className="px-4 py-3">
                    <span className={`badge text-xs px-2 py-0.5 rounded-full ${dealStatusColors[deal.status]}`}>{deal.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteMutation.mutate(deal.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DealsPage;
