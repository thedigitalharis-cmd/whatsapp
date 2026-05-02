import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/solid';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [form, setForm] = useState({ email: '', password: '', totpCode: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await authApi.login(form);
      if (data.requiresTwoFactor) {
        setRequires2FA(true);
        toast('Please enter your 2FA code');
        return;
      }
      setAuth(data.user, data.token, data.refreshToken);
      toast.success(`Welcome back, ${data.user.firstName}!`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-whatsapp-dark via-whatsapp-teal to-whatsapp-green flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
            <ChatBubbleLeftRightIcon className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">WhatsApp CRM</h1>
          <p className="text-whatsapp-light/80 mt-1">Sign in to your workspace</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                required
                className="input-field"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {requires2FA && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">2FA Code</label>
                <input
                  type="text"
                  className="input-field text-center tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  value={form.totpCode}
                  onChange={e => setForm({ ...form, totpCode: e.target.value })}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-whatsapp-green text-white font-semibold rounded-xl hover:bg-whatsapp-teal transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-whatsapp-teal font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-white/50 mt-6">
          Secured with enterprise-grade encryption
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
