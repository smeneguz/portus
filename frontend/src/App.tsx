import { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@iota/dapp-kit';
import CarrierDashboard from './pages/CarrierDashboard';
import EBLViewer from './pages/EBLViewer';
import TransferEndorse from './pages/TransferEndorse';
import SurrenderPort from './pages/SurrenderPort';
import VerifyAntiFraud from './pages/VerifyAntiFraud';

const NAV_ITEMS = [
  { path: '/carrier', label: 'Carrier Desk', subtitle: 'Issue and register eBL', step: '01' },
  { path: '/transfer', label: 'Transfer Hub', subtitle: 'Endorse and hand over title', step: '02' },
  { path: '/surrender', label: 'Port Release', subtitle: 'Surrender and accomplish cargo', step: '03' },
  { path: '/verify', label: 'Anti-Fraud', subtitle: 'Validate notarized document hash', step: '04' },
];

function pageMeta(pathname: string) {
  const exact = NAV_ITEMS.find((item) => pathname.startsWith(item.path));
  if (exact) return exact;
  return NAV_ITEMS[0];
}

export default function App() {
  const location = useLocation();
  const current = pageMeta(location.pathname);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell flex flex-col">
      <header className="sticky top-0 z-30 border-b border-[#cfdae9] bg-white/85 backdrop-blur">
        <div className="app-container py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen((v) => !v)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#cfd9e8] bg-white text-[#28486a] transition hover:bg-[#f4f8ff]"
                aria-label="Toggle workflow sidebar"
              >
                <span className="text-xl leading-none">≡</span>
              </button>
              <Link to="/" className="flex items-center gap-3">
                <img src="/logo.svg" alt="Portus" className="h-9 w-auto" />
                <div>
                  <p className="text-[1.2rem] font-extrabold tracking-tight text-[#0e4fbf]">PORTUS</p>
                  <p className="text-xs text-[#5f7389]">Bills of Lading, finally digital.</p>
                </div>
              </Link>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      <div className={`fixed inset-0 z-40 bg-[#0e27471f] transition ${sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setSidebarOpen(false)} />

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[320px] border-r border-[#cfd9e8] bg-white/95 shadow-2xl backdrop-blur transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#d9e3ef] px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5f7389]">Workflow Menu</p>
                <p className="mt-1 text-lg font-bold text-[#10365b]">Navigation</p>
              </div>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#cfd9e8] bg-white text-[#34587f] hover:bg-[#f4f8ff]"
                aria-label="Close sidebar"
              >
                ×
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`block rounded-2xl border p-3 transition ${
                  location.pathname.startsWith(item.path)
                    ? 'border-[#0e4fbf] bg-[#e8f1ff]'
                    : 'border-[#d7e2ef] bg-white hover:bg-[#f4f8ff]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex min-w-[2.2rem] justify-center rounded-lg bg-[#0e4fbf] px-2 py-1 text-xs font-bold tracking-wide text-white">
                    {item.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#143e74]">{item.label}</p>
                    <p className="text-[0.74rem] text-[#5f7389]">{item.subtitle}</p>
                  </div>
                </div>
              </Link>
            ))}
          </nav>

          <div className="border-t border-[#d9e3ef] px-4 py-3">
            <p className="text-xs text-[#5f7389]">Tip: keep this panel open while running the end-to-end shipment flow.</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 py-6">
        <div className="app-container space-y-6">
          <section className="surface p-5 md:p-6 fade-in">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-[#5f7389]">Current workspace</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0f2f50]">{current.label}</h1>
            <p className="mt-1 text-sm text-[#5f7389]">{current.subtitle}</p>
          </section>

          <section className="fade-in">
            <Routes>
              <Route path="/" element={<CarrierDashboard />} />
              <Route path="/carrier" element={<CarrierDashboard />} />
              <Route path="/ebl/:id" element={<EBLViewer />} />
              <Route path="/transfer" element={<TransferEndorse />} />
              <Route path="/surrender" element={<SurrenderPort />} />
              <Route path="/verify" element={<VerifyAntiFraud />} />
            </Routes>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#cfdae9] bg-white/70 py-5 text-center text-xs text-[#5f7389]">
        <div className="app-container">Portus · Electronic Bill of Lading protocol on IOTA</div>
      </footer>
    </div>
  );
}
