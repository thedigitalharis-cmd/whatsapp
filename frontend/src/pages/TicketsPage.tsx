import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, StarIcon } from '@heroicons/react/24/outline';
import { ticketsApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  OPEN: 'badge-blue', IN_PROGRESS: 'badge-yellow', WAITING_CUSTOMER: 'badge-purple',
  RESOLVED: 'badge-green', CLOSED: 'badge-gray',
};

const priorityColors: Record<string, string> = {
  LOW: 'text-gray-500', NORMAL: 'text-blue-500', HIGH: 'text-orange-500', URGENT: 'text-red-500',
};

const TicketsPage: React.FC = () => {
  const [filter, setFilter] = useState({ status: '', priority: '' });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ subject: '', description: '', priority: 'NORMAL', contactId: '' });
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['tickets', filter],
    queryFn: () => ticketsApi.list(filter).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: ticketsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setShowModal(false); toast.success('Ticket created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => ticketsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); toast.success('Ticket updated'); },
  });

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Ticket</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
                <input className="input-field" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select className="input-field" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} className="btn-primary flex-1">Create Ticket</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} total tickets</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Ticket
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex gap-4">
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All Status</option>
          {['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none" value={filter.priority} onChange={e => setFilter({ ...filter, priority: e.target.value })}>
          <option value="">All Priority</option>
          {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Ticket</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Contact</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Priority</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Assignee</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">CSAT</th>
              <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Created</th>
              <th className="text-right text-xs font-semibold text-gray-600 uppercase px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.data || []).map((ticket: any) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{ticket.subject}</p>
                  {ticket.slaDeadline && (
                    <p className="text-xs text-orange-500">SLA: {format(new Date(ticket.slaDeadline), 'MMM d, HH:mm')}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {ticket.contact?.firstName} {ticket.contact?.lastName}
                </td>
                <td className="px-4 py-3">
                  <span className={`badge ${statusColors[ticket.status]}`}>{ticket.status.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${priorityColors[ticket.priority]}`}>{ticket.priority}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {ticket.assignee ? `${ticket.assignee.firstName} ${ticket.assignee.lastName}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {ticket.csatScore && (
                    <div className="flex items-center gap-1">
                      <StarIcon className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                      <span className="text-sm font-medium">{ticket.csatScore}/5</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</td>
                <td className="px-4 py-3 text-right">
                  {ticket.status !== 'RESOLVED' && (
                    <button
                      onClick={() => updateMutation.mutate({ id: ticket.id, data: { status: 'RESOLVED', resolvedAt: new Date() } })}
                      className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                    >
                      Resolve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TicketsPage;
