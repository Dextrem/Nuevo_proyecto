import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import SessionWarning from './components/SessionWarning';

import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const POS = lazy(() => import('./pages/POS'));
const Clients = lazy(() => import('./pages/Clients'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Accounting = lazy(() => import('./pages/Accounting'));
const Reports = lazy(() => import('./pages/Reports'));
const Billing = lazy(() => import('./pages/Billing'));
const Users = lazy(() => import('./pages/Users'));
const Settings = lazy(() => import('./pages/Settings'));
const AccountsReceivable = lazy(() => import('./pages/AccountsReceivable'));
const AccountsPayable = lazy(() => import('./pages/AccountsPayable'));
const CashRegister = lazy(() => import('./pages/CashRegister'));
const Costs = lazy(() => import('./pages/Costs'));
const Quotations = lazy(() => import('./pages/Quotations'));
const Budget = lazy(() => import('./pages/Budget'));
const UserHistory = lazy(() => import('./pages/UserHistory'));
const POSQR = lazy(() => import('./pages/POSQR'));
const MonthlyClosing = lazy(() => import('./pages/MonthlyClosing'));
const Commissions = lazy(() => import('./pages/Commissions'));
const FiscalReports = lazy(() => import('./pages/FiscalReports'));

const LoadingFallback = () => (
  <div className="loading-fallback">
    <div className="spinner"></div>
    <p>Cargando...</p>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="login-wrapper">
        <LoadingFallback />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <>
      <SessionWarning />
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/pos" element={<POS />} />
                      <Route path="/pos-qr" element={<POSQR />} />
                      <Route path="/billing" element={<Billing />} />
                      <Route path="/clients" element={<Clients />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/accounts-receivable" element={<AccountsReceivable />} />
                      <Route path="/accounts-payable" element={<AccountsPayable />} />
                      <Route path="/cash-register" element={<CashRegister />} />
                      <Route path="/accounting" element={<Accounting />} />
                      <Route path="/costs" element={<Costs />} />
                      <Route path="/quotations" element={<Quotations />} />
                      <Route path="/budget" element={<Budget />} />
                      <Route path="/monthly-closing" element={<MonthlyClosing />} />
                      <Route path="/commissions" element={<Commissions />} />
                      <Route path="/history" element={<UserHistory />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/fiscal" element={<FiscalReports />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;
