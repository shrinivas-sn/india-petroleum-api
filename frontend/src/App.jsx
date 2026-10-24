import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import DataBanner from './components/DataBanner';
import ErrorBoundary from './components/ErrorBoundary';
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { LiveDataProvider } from './lib/live';
import { usePageMeta } from './lib/seo';
import DocsPage from './pages/DocsPage';
import GuidesPage from './pages/GuidesPage';
import HomePage from './pages/HomePage';
import NotFoundPage from './pages/NotFoundPage';
import PlaygroundPage from './pages/PlaygroundPage';
import StatusPage from './pages/StatusPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppContent() {
  usePageMeta();
  const { pathname } = useLocation();
  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar />
      <DataBanner />
      <main id="main">
        <ScrollToTop />
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/docs" element={<DocsPage />} />
            <Route path="/playground" element={<PlaygroundPage />} />
            <Route path="/guides" element={<GuidesPage />} />
            <Route path="/guides/:id" element={<GuidesPage />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  );
}

// The browser entry. The prerenderer renders AppContent alone, so the static HTML carries the build-time figures.
export default function App() {
  return (
    <LiveDataProvider>
      <AppContent />
    </LiveDataProvider>
  );
}
