import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { analyticsApi } from '../services/api';

const COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#6366f1', '#f59e0b', '#ef4444'];

const AnalyticsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', dateRange],
    queryFn: () => analyticsApi.dashboard(dateRange).then(r => r.data),
  });

  const { data: funnel } = useQuery({ queryKey: ['funnel'], queryFn: () => analyticsApi.funnel().then(r => r.data) });
  const { data: revenue } = useQuery({ queryKey: ['revenue-chart'], queryFn: () => analyticsApi.revenue().then(r => r.data) });
  const { data: messageVolume } = useQuery({ queryKey: ['message-volume'], queryFn: () => analyticsApi.messages({ days: 30 }).then(r => r.data) });
  const { data: sourceData } = useQuery({ queryKey: ['leads-by-source'], queryFn: () => analyticsApi.leadsBySource().then(r => r.data) });
  const { data: agentData } = useQuery({ queryKey: ['agent-performance'], queryFn: () => analyticsApi.agents().then(r => r.data) });

  const kpis = [
    { label: 'Total Contacts', value: stats?.totalContacts?.toLocaleString() || '0' },
    { label: 'New Leads', value: stats?.newLeads?.toLocaleString() || '0' },
    { label: 'Open Conversations', value: stats?.openConversations?.toLocaleString() || '0' },
    { label: 'Total Revenue', value: `$${(stats?.totalRevenue || 0).toLocaleString()}` },
    { label: 'Deals Won', value: stats?.dealsWon || '0' },
    { label: 'Messages In', value: stats?.messagesIn?.toLocaleString() || '0' },
    { label: 'Resolved', value: stats?.resolvedConversations?.toLocaleString() || '0' },
    { label: 'Broadcasts', value: stats?.broadcastsSent || '0' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-gray-500 text-sm mt-1">Track your CRM performance</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" className="input-field w-auto text-sm" value={dateRange.from} onChange={e => setDateRange({ ...dateRange, from: e.target.value })} />
          <span className="text-gray-500 text-sm">to</span>
          <input type="date" className="input-field w-auto text-sm" value={dateRange.to} onChange={e => setDateRange({ ...dateRange, to: e.target.value })} />
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Message Volume (30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={messageVolume || []}>
              <defs>
                <linearGradient id="in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#128C7E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#128C7E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="in" name="Inbound" stroke="#25D366" fill="url(#in)" strokeWidth={2} />
              <Area type="monotone" dataKey="out" name="Outbound" stroke="#128C7E" fill="url(#out)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Month</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#25D366" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Funnel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {(funnel || []).map((item: any, i: number) => {
              const max = funnel[0]?.count || 1;
              return (
                <div key={item.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.stage}</span>
                    <span className="font-semibold">{item.count} ({Math.round((item.count / max) * 100)}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${(item.count / max) * 100}%`, backgroundColor: COLORS[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Leads by Source */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sourceData || []}
                cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                paddingAngle={4} dataKey="count" nameKey="source"
              >
                {(sourceData || []).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend formatter={(v) => v.replace(/_/g, ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Performance */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Agent Performance</h3>
          <div className="space-y-3">
            {(agentData || []).slice(0, 6).map((agent: any) => (
              <div key={agent.id} className="flex items-center gap-3">
                <div className="w-7 h-7 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {agent.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{agent.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div className="bg-whatsapp-green h-1.5 rounded-full" style={{ width: `${Math.min(agent.resolvedConversations / 10 * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">{agent.resolvedConversations}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
