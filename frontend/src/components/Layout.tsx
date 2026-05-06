import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HomeIcon, ChatBubbleLeftRightIcon, UsersIcon, FunnelIcon,
  BriefcaseIcon, MegaphoneIcon, BoltIcon, ChartBarIcon,
  TicketIcon, ShoppingBagIcon, Cog6ToothIcon, DocumentTextIcon,
  BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, BellIcon,
  MagnifyingGlassIcon, ArrowRightOnRectangleIcon, Squares2X2Icon,
  QueueListIcon, ClockIcon, SunIcon, MoonIcon,
} from '@heroicons/react/24/outline';
import { ChatBubbleLeftRightIcon as ChatSolid } from '@heroicons/react/24/solid';
import { useAuthStore } from '../store/authStore';
import { useSocketStore } from '../store/socketStore';
import { useThemeStore } from '../store/themeStore';
import { authApi } from '../services/api';
import toast from 'react-hot-toast';

const navItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon },
  { path: '/inbox', label: 'Inbox', icon: ChatBubbleLeftRightIcon, badge: true },
  { path: '/contacts', label: 'Contacts', icon: UsersIcon },
  { path: '/leads', label: 'Leads', icon: FunnelIcon },
  { path: '/deals', label: 'Deals', icon: BriefcaseIcon },
  { path: '/broadcasts', label: 'Broadcasts', icon: MegaphoneIcon },
  { path: '/campaigns', label: 'Campaigns', icon: QueueListIcon },
  { path: '/automations', label: 'Automations', icon: BoltIcon },
  { path: '/templates', label: 'Templates', icon: DocumentTextIcon },
  { path: '/analytics', label: 'Analytics', icon: ChartBarIcon },
  { path: '/tickets', label: 'Tickets', icon: TicketIcon },
  { path: '/products', label: 'Products', icon: ShoppingBagIcon },
  { path: '/follow-ups', label: 'Follow-ups', icon: ClockIcon },
  { path: '/knowledge-base', label: 'Knowledge Base', icon: BookOpenIcon },
  { path: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { disconnect } = useSocketStore();
  const { theme, toggleTheme } = useThemeStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.style.backgroundColor = '';
    }
  }, [theme]);

  const isDark = theme === 'dark';

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {}
    disconnect();
    logout();
    toast.success('Logged out');
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <aside className={`flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'} ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'} border-r`}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="w-9 h-9 bg-whatsapp-green rounded-xl flex items-center justify-center flex-shrink-0">
            <ChatSolid className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>WhatsApp CRM</h1>
              <p className={`text-xs truncate max-w-[130px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.organization?.name || 'Loading...'}</p>
            </div>
          )}
        </div>

        {/* Search */}
        {!collapsed && (
          <div className={`px-3 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className={`w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp-green/50 ${isDark ? 'bg-gray-800 text-gray-200 placeholder-gray-500' : 'bg-gray-100 text-gray-900'}`}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group
                  ${isActive
                    ? 'bg-whatsapp-green/10 text-whatsapp-teal'
                    : isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                title={collapsed ? label : undefined}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-whatsapp-teal' : isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-500 group-hover:text-gray-700'}`} />
                {!collapsed && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className={`border-t p-3 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.firstName} {user?.lastName}</p>
                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.role}</p>
              </div>
              {/* Theme Toggle */}
              <button onClick={toggleTheme} className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isDark ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`} title={isDark ? 'Light mode' : 'Dark mode'}>
                {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {collapsed && (
            <button onClick={toggleTheme} className={`p-1.5 rounded-lg w-full flex justify-center mb-2 ${isDark ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}>
              {isDark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-1"
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-10"
        >
          {collapsed ? <ChevronRightIcon className="w-3 h-3 text-gray-600" /> : <ChevronLeftIcon className="w-3 h-3 text-gray-600" />}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Bar */}
        <header className={`px-6 py-3 flex items-center justify-between border-b ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center gap-2">
            <Squares2X2Icon className={`w-4 h-4 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
            <nav className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {navItems.find(n => n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path))?.label || 'Dashboard'}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button className={`relative p-2 rounded-lg ${isDark ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
              <BellIcon className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-whatsapp-green rounded-full flex items-center justify-center text-white text-xs font-bold">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="hidden sm:block">
                <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user?.firstName} {user?.lastName}</p>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{user?.email}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
