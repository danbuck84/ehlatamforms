import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ThemeProvider } from '../lib/theme';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { SwUpdateAndOfflineToast } from '../components/SwUpdateAndOfflineToast';
import { CheckinPage } from '../features/checkin/CheckinPage';
import { PrivacyPage } from './PrivacyPage';

const AdminPage = lazy(() => import('../features/admin/AdminPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  },
});

export function AppShell() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        {t('app.skipToMain')}
      </a>
      <SwUpdateAndOfflineToast />
      <Header />
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <Routes>
          <Route path="/" element={<CheckinPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/admin"
            element={
              <Suspense
                fallback={
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text-secondary)]">
                    Loading admin panel...
                  </div>
                }
              >
                <AdminPage />
              </Suspense>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AppShell />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
