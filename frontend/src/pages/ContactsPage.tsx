import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, MagnifyingGlassIcon, FunnelIcon, ArrowDownTrayIcon,
  ArrowUpTrayIcon, TrashIcon, PencilIcon, PhoneIcon, EnvelopeIcon,
  BuildingOfficeIcon, TagIcon, CheckIcon,
} from '@heroicons/react/24/outline';
import { contactsApi } from '../services/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const sourceColors: Record<string, string> = {
  MANUAL: 'badge-gray',
  WEB_FORM: 'badge-blue',
  WHATSAPP: 'badge-green',
  INSTAGRAM: 'badge-purple',
  FACEBOOK_ADS: 'badge-blue',
  IMPORT: 'badge-gray',
};

const ContactModal: React.FC<{
  contact?: any;
  onClose: () => void;
  onSave: (data: any) => void;
}> = ({ contact, onClose, onSave }) => {
  const [form, setForm] = useState({
    firstName: contact?.firstName || '',
    lastName: contact?.lastName || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    company: contact?.company || '',
    jobTitle: contact?.jobTitle || '',
    source: contact?.source || 'MANUAL',
    notes: contact?.notes || '',
    gdprConsent: contact?.gdprConsent || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{contact ? 'Edit Contact' : 'Add Contact'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
              <input required className="input-field" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <input className="input-field" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
            <input required className="input-field" placeholder="+1234567890" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" className="input-field" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <input className="input-field" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input className="input-field" value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select className="input-field" value={form.source} onChange={e => setForm({ ...form, source: e.target.value })}>
              {['MANUAL', 'WEB_FORM', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK_ADS', 'IMPORT', 'API'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.gdprConsent} onChange={e => setForm({ ...form, gdprConsent: e.target.checked })} className="rounded" />
            <span className="text-sm text-gray-700">GDPR Consent obtained</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Save Contact</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ContactsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<any>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', page, search],
    queryFn: () => contactsApi.list({ page, limit: 50, search }).then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: contactsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setShowModal(false);
      toast.success('Contact created');
    },
    onError: () => toast.error('Failed to create contact'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => contactsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      setEditContact(null);
      toast.success('Contact updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: contactsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact deleted');
    },
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSave = (formData: any) => {
    if (editContact) {
      updateMutation.mutate({ id: editContact.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6">
      {(showModal || editContact) && (
        <ContactModal
          contact={editContact}
          onClose={() => { setShowModal(false); setEditContact(null); }}
          onSave={handleSave}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.total || 0} total contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <ArrowUpTrayIcon className="w-4 h-4" />
            Import
          </button>
          <button className="btn-secondary">
            <ArrowDownTrayIcon className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, phone, email..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="btn-secondary">
          <FunnelIcon className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="bg-whatsapp-green/10 border border-whatsapp-green/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-4">
          <span className="text-sm font-medium text-whatsapp-teal">{selected.length} selected</span>
          <button className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1">
            <TrashIcon className="w-3.5 h-3.5" /> Delete
          </button>
          <button className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <TagIcon className="w-3.5 h-3.5" /> Tag
          </button>
          <button onClick={() => setSelected([])} className="ml-auto text-xs text-gray-500">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 pl-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.length === (data?.data?.length || 0) && selected.length > 0}
                    onChange={e => setSelected(e.target.checked ? (data?.data || []).map((c: any) => c.id) : [])}
                    className="rounded"
                  />
                </th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Phone</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Email</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Company</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Source</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Tags</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Added</th>
                <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : (data?.data || []).map((contact: any) => (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="pl-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(contact.id)}
                      onChange={() => toggleSelect(contact.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-whatsapp-green to-whatsapp-teal rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {contact.firstName?.[0]}{contact.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</p>
                        {contact.gdprConsent && <p className="text-xs text-green-600">✓ GDPR</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-gray-700 hover:text-whatsapp-teal">
                      <PhoneIcon className="w-3.5 h-3.5" />
                      {contact.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contact.email && (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-1 hover:text-whatsapp-teal">
                        <EnvelopeIcon className="w-3.5 h-3.5" />
                        {contact.email}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {contact.company && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <BuildingOfficeIcon className="w-3.5 h-3.5" />
                        {contact.company}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${sourceColors[contact.source] || 'badge-gray'}`}>
                      {contact.source?.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(contact.tags || []).slice(0, 2).map((tag: any) => (
                        <span key={tag.id} className="px-1.5 py-0.5 text-xs rounded-full text-white" style={{ backgroundColor: tag.color }}>
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(new Date(contact.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => setEditContact(contact)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(contact.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, data?.total || 0)} of {data?.total || 0}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              disabled={page * 50 >= (data?.total || 0)}
              onClick={() => setPage(p => p + 1)}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactsPage;
