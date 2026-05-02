import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  UsersIcon, ChatBubbleLeftRightIcon, FunnelIcon, CurrencyDollarIcon,
  MegaphoneIcon, ArrowTrendingUpIcon, CheckCircleIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { analyticsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

const COLORS = ['#25D366', '#128C7E', '#075E54', '#34B7F1', '#6366f1', '#f59e0b'];

const StatCard: React.FC<{
  title: string; value: string | number; icon: React.ElementType;
  color: string; change?: string; positive?: boolean;
}> = ({ title, value, icon: Icon, color, change, positive }) => (
  <div className="card p-5">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {change && (
      <p className={`text-xs mt-1 ${positive ? 'text-green-600' : 'text-red-500'}`}>
        {positive ? '↑' : '↓'} {change} vs last period
      </p>
    )}
  </div>
);

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsApi.dashboard().then(r => r.data),
  });

  const { data: funnel } = useQuery({
    queryKey: ['funnel'],
    queryFn: () => analyticsApi.funnel().then(r => r.data),
  });

  const { data: revenue } = useQuery({
    queryKey: ['revenue-chart'],
    queryFn: () => analyticsApi.revenue().then(r => r.data),
  });

  const { data: messageVolume } = useQuery({
    queryKey: ['message-volume'],
    queryFn: () => analyticsApi.messages({ days: 14 }).then(r => r.data),
  });

  const { data: sourceData } = useQuery({
    queryKey: ['leads-by-source'],
    queryFn: () => analyticsApi.leadsBySource().then(r => r.data),
  });

  const { data: agentData } = useQuery({
    queryKey: ['agent-performance'],
    queryFn: () => analyticsApi.agents().then(r => r.data),
  });

  const statCards = [
    { title: 'Total Contacts', value: stats?.totalContacts?.toLocaleString() || '0', icon: UsersIcon, color: 'bg-blue-500', change: '12%', positive: true },
    { title: 'New Leads', value: stats?.newLeads?.toLocaleString() || '0', icon: FunnelIcon, color: 'bg-purple-500', change: '8%', positive: true },
    { title: 'Open Conversations', value: stats?.openConversations?.toLocaleString() || '0', icon: ChatBubbleLeftRightIcon, color: 'bg-whatsapp-green', change: '3%', positive: false },
    { title: 'Revenue Won', value: `$${(stats?.totalRevenue || 0).toLocaleString()}`, icon: CurrencyDollarIcon, color: 'bg-emerald-500', change: '24%', positive: true },
    { title: 'Deals Won', value: stats?.dealsWon || '0', icon: CheckCircleIcon, color: 'bg-teal-500', change: '15%', positive: true },
    { title: 'Broadcasts Sent', value: stats?.broadcastsSent || '0', icon: MegaphoneIcon, color: 'bg-orange-500', change: '5%', positive: true },
    { title: 'Messages In', value: stats?.messagesIn?.toLocaleString() || '0', icon: ArrowTrendingUpIcon, color: 'bg-indigo-500' },
    { title: 'Resolved', value: stats?.resolvedConversations?.toLocaleString() || '0', icon: ClockIcon, color: 'bg-sky-500' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {user?.firstName} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here's what's happening with your CRM today</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message Volume */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Message Volume (Last 14 Days)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={messageVolume || []}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#128C7E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#128C7E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="in" name="Inbound" stroke="#25D366" fill="url(#colorIn)" strokeWidth={2} />
              <Area type="monotone" dataKey="out" name="Outbound" stroke="#128C7E" fill="url(#colorOut)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={sourceData || [{ source: 'WHATSAPP', count: 45 }, { source: 'WEB_FORM', count: 30 }, { source: 'INSTAGRAM', count: 25 }]}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={4}
                dataKey="count"
                nameKey="source"
              >
                {(sourceData || []).map((_: any, index: number) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend formatter={(value) => value.replace(/_/g, ' ')} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue (Won Deals)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#25D366" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3 mt-2">
            {(funnel || [
              { stage: 'Contacts', count: 1200 },
              { stage: 'Leads', count: 480 },
              { stage: 'Qualified', count: 180 },
              { stage: 'Deals', count: 72 },
              { stage: 'Won', count: 36 },
            ]).map((item: any, i: number) => {
              const max = funnel?.[0]?.count || item.count;
              const pct = max ? (item.count / max) * 100 : 0;
              return (
                <div key={item.stage}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{item.stage}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: COLORS[i] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Agent Performance */}
      {agentData && agentData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Agent Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 pb-3">Agent</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">Resolved</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">Avg Response</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">CSAT</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">Deals Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {agentData.map((agent: any) => (
                  <tr key={agent.id}>
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-7 h-7 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {agent.name[0]}
                      </div>
                      <span className="font-medium">{agent.name}</span>
                    </td>
                    <td className="text-right text-gray-700 py-3">{agent.resolvedConversations}</td>
                    <td className="text-right text-gray-700 py-3">{agent.avgResponseTime}s</td>
                    <td className="text-right py-3">
                      <span className={`badge ${agent.csatAvg >= 4 ? 'badge-green' : agent.csatAvg >= 3 ? 'badge-yellow' : 'badge-red'}`}>
                        {agent.csatAvg.toFixed(1)}
                      </span>
                    </td>
                    <td className="text-right font-semibold text-emerald-600 py-3">{agent.dealsWon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
