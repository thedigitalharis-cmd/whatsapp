import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, PencilIcon, TrashIcon, ShoppingBagIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { productsApi, ordersApi } from '../services/api';
import toast from 'react-hot-toast';

const ProductsPage: React.FC = () => {
  const [tab, setTab] = useState<'products' | 'orders'>('products');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', currency: 'USD', sku: '', stock: '' });
  const qc = useQueryClient();

  const { data: products } = useQuery({ queryKey: ['products'], queryFn: () => productsApi.list().then(r => r.data) });
  const { data: orders } = useQuery({ queryKey: ['orders'], queryFn: () => ordersApi.list().then(r => r.data) });

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); toast.success('Product created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Deleted'); },
  });

  return (
    <div className="p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Product</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input className="input-field" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input type="number" className="input-field" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select className="input-field" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                    {['USD', 'EUR', 'GBP', 'INR', 'AED', 'BRL'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                  <input type="number" className="input-field" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                <input className="input-field" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={() => createMutation.mutate({ ...form, price: Number(form.price), stock: Number(form.stock) || undefined })} className="btn-primary flex-1">Add Product</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commerce</h1>
          <p className="text-gray-500 text-sm mt-1">Products, catalog & orders</p>
        </div>
        {tab === 'products' && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <PlusIcon className="w-4 h-4" />
            Add Product
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(['products', 'orders'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'products' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(products?.data || []).map((product: any) => (
            <div key={product.id} className="card overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <ShoppingBagIcon className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                {product.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-whatsapp-teal">
                    {product.currency} {product.price.toLocaleString()}
                  </span>
                  {product.stock !== null && (
                    <span className={`text-xs ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteMutation.mutate(product.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Order ID</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Customer</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Total</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-gray-600 uppercase px-4 py-3">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(orders?.data || []).map((order: any) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{order.contact?.firstName} {order.contact?.lastName}</td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">{order.currency} {order.total.toLocaleString()}</td>
                  <td className="px-4 py-3"><span className="badge badge-blue">{order.status}</span></td>
                  <td className="px-4 py-3">
                    <span className={`badge ${order.paymentStatus === 'PAID' ? 'badge-green' : 'badge-yellow'}`}>{order.paymentStatus}</span>
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

export default ProductsPage;
