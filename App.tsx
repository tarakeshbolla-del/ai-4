
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import UserView from './components/end-user/UserView';
import AdminLayout from './components/admin/AdminLayout';
import DashboardView from './components/admin/DashboardView';
import AnalyticsView from './components/admin/AnalyticsView';
import KnowledgeBaseView from './components/admin/KnowledgeBaseView';
import SettingsView from './components/admin/SettingsView';

const App: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div className={`${theme} font-sans text-light-text dark:text-dark-text`}>
      <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
        <HashRouter>
          <Routes>
            <Route path="/" element={<UserView />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardView />} />
              <Route path="analytics" element={<AnalyticsView />} />
              <Route path="knowledge-base" element={<KnowledgeBaseView />} />
              <Route path="settings" element={<SettingsView />} />
            </Route>
          </Routes>
        </HashRouter>
      </div>
    </div>
  );
};

export default App;
