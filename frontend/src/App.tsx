import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';

import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import InboxPage from './pages/InboxPage';
import ContactsPage from './pages/ContactsPage';
import LeadsPage from './pages/LeadsPage';
import DealsPage from './pages/DealsPage';
import BroadcastsPage from './pages/BroadcastsPage';
import CampaignsPage from './pages/CampaignsPage';
import AutomationsPage from './pages/AutomationsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import TicketsPage from './pages/TicketsPage';
import ProductsPage from './pages/ProductsPage';
import SettingsPage from './pages/SettingsPage';
import TemplatesPage from './pages/TemplatesPage';
import KnowledgeBasePage from './pages/KnowledgeBasePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, logout } = useAuthStore();
  const token = localStorage.getItem('token');

  // If Zustand says authenticated but token is gone, clear state
  if (isAuthenticated && !token) {
    logout();
    return <Navigate to="/login" replace />;
  }

  return isAuthenticated && token ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  const { isAuthenticated, user, token } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    if (isAuthenticated && token && user) {
      connect(token, user.organizationId);
    } else {
      disconnect();
    }
  }, [isAuthenticated, token, user]);

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { background: '#1f2937', color: '#fff', borderRadius: '10px', fontSize: '14px' },
            success: { iconTheme: { primary: '#25D366', secondary: '#fff' } },
          }}
        />
        <Routes>
          <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route index element={<DashboardPage />} />
                    <Route path="inbox" element={<InboxPage />} />
                    <Route path="contacts" element={<ContactsPage />} />
                    <Route path="leads" element={<LeadsPage />} />
                    <Route path="deals" element={<DealsPage />} />
                    <Route path="broadcasts" element={<BroadcastsPage />} />
                    <Route path="campaigns" element={<CampaignsPage />} />
                    <Route path="automations" element={<AutomationsPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="tickets" element={<TicketsPage />} />
                    <Route path="products" element={<ProductsPage />} />
                    <Route path="templates" element={<TemplatesPage />} />
                    <Route path="knowledge-base" element={<KnowledgeBasePage />} />
                    <Route path="settings/*" element={<SettingsPage />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
