import { AuthProvider, useAuth } from './lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './components/AuthPage';
import { Dashboard } from './components/Dashboard';

function AppContent() {
  const { user, profile, loading, isAuthReady } = useAuth();

  if (!isAuthReady || loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">ቤጉ እንግዳ / Begu Engeda...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
