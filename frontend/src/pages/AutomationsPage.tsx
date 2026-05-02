import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlusIcon, BoltIcon, PencilIcon, TrashIcon,
  PlayIcon, PauseIcon, SparklesIcon,
} from '@heroicons/react/24/outline';
import { automationsApi } from '../services/api';
import toast from 'react-hot-toast';

const typeIcons: Record<string, string> = {
  CHATBOT: '🤖',
  WORKFLOW: '⚙️',
  ASSIGNMENT_RULE: '👤',
  AUTO_REPLY: '💬',
};

const AutomationsPage: React.FC = () => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'CHATBOT',
    aiEnabled: false,
    systemPrompt: '',
    trigger: { event: 'message_received', conditions: [] },
    flow: {
      nodes: [
        { id: 'start', type: 'trigger', data: { label: 'Message Received' }, position: { x: 250, y: 0 } },
        { id: 'reply', type: 'sendMessage', data: { label: 'Send Reply', message: '' }, position: { x: 250, y: 100 } },
      ],
      edges: [{ id: 'e1', source: 'start', target: 'reply' }],
    },
  });
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['automations'],
    queryFn: () => automationsApi.list().then(r => r.data),
  });

  const createMutation = useMutation({
    mutationFn: automationsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); setShowModal(false); toast.success('Automation created'); },
  });

  const toggleMutation = useMutation({
    mutationFn: automationsApi.toggle,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Status updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: automationsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['automations'] }); toast.success('Deleted'); },
  });

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Automation</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select className="input-field" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                  {['CHATBOT', 'WORKFLOW', 'ASSIGNMENT_RULE', 'AUTO_REPLY'].map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.aiEnabled} onChange={e => setForm({ ...form, aiEnabled: e.target.checked })} className="rounded" />
                <SparklesIcon className="w-4 h-4 text-indigo-500" />
                <span className="text-sm text-gray-700">AI/GPT Powered</span>
              </label>
              {form.aiEnabled && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AI System Prompt</label>
                  <textarea
                    className="input-field" rows={4}
                    placeholder="You are a helpful customer support agent for [Company]. Be friendly and concise..."
                    value={form.systemPrompt}
                    onChange={e => setForm({ ...form, systemPrompt: e.target.value })}
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate(form)} className="btn-primary flex-1">Create Automation</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automations</h1>
          <p className="text-gray-500 text-sm mt-1">Chatbots, workflows & auto-replies</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Automation
        </button>
      </div>

      {/* Types Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {['CHATBOT', 'WORKFLOW', 'ASSIGNMENT_RULE', 'AUTO_REPLY'].map(type => {
          const count = (data || []).filter((a: any) => a.type === type).length;
          const active = (data || []).filter((a: any) => a.type === type && a.status === 'ACTIVE').length;
          return (
            <div key={type} className="card p-4 text-center">
              <div className="text-2xl mb-2">{typeIcons[type]}</div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{type.replace(/_/g, ' ')}</p>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-green-600">{active} active</p>
            </div>
          );
        })}
      </div>

      {/* Automation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data || []).map((automation: any) => (
          <div key={automation.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{typeIcons[automation.type]}</span>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">{automation.name}</h3>
                  <p className="text-xs text-gray-500">{automation.type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${automation.status === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-300'}`} />
            </div>

            {automation.description && (
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{automation.description}</p>
            )}

            {automation.aiEnabled && (
              <div className="flex items-center gap-1 text-xs text-indigo-600 mb-3">
                <SparklesIcon className="w-3.5 h-3.5" />
                AI Powered
              </div>
            )}

            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={() => toggleMutation.mutate(automation.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg flex-1 justify-center
                  ${automation.status === 'ACTIVE'
                    ? 'text-yellow-700 bg-yellow-50 hover:bg-yellow-100'
                    : 'text-green-700 bg-green-50 hover:bg-green-100'
                  }`}
              >
                {automation.status === 'ACTIVE' ? (
                  <><PauseIcon className="w-3.5 h-3.5" />Pause</>
                ) : (
                  <><PlayIcon className="w-3.5 h-3.5" />Activate</>
                )}
              </button>
              <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteMutation.mutate(automation.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Add New Card */}
        <button
          onClick={() => setShowModal(true)}
          className="card p-5 border-2 border-dashed border-gray-300 hover:border-whatsapp-green hover:bg-whatsapp-green/5 transition-colors flex flex-col items-center justify-center gap-2 min-h-[160px]"
        >
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <PlusIcon className="w-5 h-5 text-gray-500" />
          </div>
          <p className="text-sm font-medium text-gray-600">Add Automation</p>
          <p className="text-xs text-gray-400">Chatbot, workflow, or rule</p>
        </button>
      </div>
    </div>
  );
};

export default AutomationsPage;
