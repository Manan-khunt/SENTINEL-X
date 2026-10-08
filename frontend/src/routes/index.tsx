import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { IncidentsListPage } from '../pages/IncidentsListPage';
import { IncidentDetailPage } from '../pages/IncidentDetailPage';
import { EvaluationPage } from '../pages/EvaluationPage';
import { ReplayPage } from '../pages/ReplayPage';
import { AuditPage } from '../pages/AuditPage';
import { SystemPage } from '../pages/SystemPage';
import { useAuthStore } from '../stores/authStore';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Login */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Console Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="incidents" element={<IncidentsListPage />} />
        
        {/* Incident Detail and Sub-routes */}
        <Route path="incidents/:id" element={<IncidentDetailPage />} />
        <Route path="incidents/:id/graph" element={<IncidentDetailPage />} />
        <Route path="incidents/:id/timeline" element={<IncidentDetailPage />} />
        <Route path="incidents/:id/actions" element={<IncidentDetailPage />} />
        <Route path="incidents/:id/audit" element={<IncidentDetailPage />} />

        {/* Evaluation, Replay, Audit, System */}
        <Route path="evaluation" element={<EvaluationPage />} />
        <Route path="replay" element={<ReplayPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="system" element={<SystemPage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};
