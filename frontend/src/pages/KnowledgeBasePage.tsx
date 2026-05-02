import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, MagnifyingGlassIcon, PencilIcon, TrashIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import { kbApi } from '../services/api';
import toast from 'react-hot-toast';

const KnowledgeBasePage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editArticle, setEditArticle] = useState<any>(null);
  const [form, setForm] = useState({ title: '', content: '', category: '', tags: '' });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ['kb', search], queryFn: () => kbApi.list({ search }).then(r => r.data) });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editArticle ? kbApi.update(editArticle.id, data) : kbApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kb'] });
      setShowModal(false); setEditArticle(null);
      setForm({ title: '', content: '', category: '', tags: '' });
      toast.success(editArticle ? 'Updated' : 'Article created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: kbApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['kb'] }); toast.success('Deleted'); },
  });

  const openEdit = (article: any) => {
    setEditArticle(article);
    setForm({ title: article.title, content: article.content, category: article.category || '', tags: (article.tags || []).join(', ') });
    setShowModal(true);
  };

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editArticle ? 'Edit Article' : 'New Article'}</h2>
              <button onClick={() => { setShowModal(false); setEditArticle(null); }} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input className="input-field" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input className="input-field" placeholder="e.g. FAQ, Policies, How-to" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
                <textarea className="input-field" rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma separated)</label>
                <input className="input-field" placeholder="refund, shipping, account" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => { setShowModal(false); setEditArticle(null); }} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => saveMutation.mutate({ ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) })} className="btn-primary flex-1">Save Article</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.length || 0} articles</p>
        </div>
        <button onClick={() => { setEditArticle(null); setForm({ title: '', content: '', category: '', tags: '' }); setShowModal(true); }} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          New Article
        </button>
      </div>

      {/* Search */}
      <div className="card p-4 mb-5">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search articles..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data || []).map((article: any) => (
          <div key={article.id} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <BookOpenIcon className="w-5 h-5 text-whatsapp-teal flex-shrink-0 mt-0.5" />
              {article.category && (
                <span className="badge badge-blue text-xs">{article.category}</span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-2">{article.title}</h3>
            <p className="text-xs text-gray-500 line-clamp-3 mb-3">{article.content}</p>
            {article.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {article.tags.slice(0, 3).map((tag: string) => (
                  <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-md">{tag}</span>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => openEdit(article)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                <PencilIcon className="w-4 h-4" />
              </button>
              <button onClick={() => deleteMutation.mutate(article.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KnowledgeBasePage;
