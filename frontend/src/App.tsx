import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { ConnectButton } from '@iota/dapp-kit';
import CarrierDashboard from './pages/CarrierDashboard';
import EBLViewer from './pages/EBLViewer';
import TransferEndorse from './pages/TransferEndorse';
import SurrenderPort from './pages/SurrenderPort';
import VerifyAntiFraud from './pages/VerifyAntiFraud';

const NAV_ITEMS = [
  { path: '/carrier', label: 'Carrier' },
  { path: '/transfer', label: 'Transfer' },
  { path: '/surrender', label: 'Surrender' },
  { path: '/verify', label: 'Verify' },
];

export default function App() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Portus" className="h-8 w-auto" />
            <span className="text-2xl font-bold text-blue-700">PORTUS</span>
            <span className="text-sm text-gray-500 hidden sm:inline">Bills of Lading, finally digital.</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  location.pathname.startsWith(item.path)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <ConnectButton />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <Routes>
          <Route path="/" element={<CarrierDashboard />} />
          <Route path="/carrier" element={<CarrierDashboard />} />
          <Route path="/ebl/:id" element={<EBLViewer />} />
          <Route path="/transfer" element={<TransferEndorse />} />
          <Route path="/surrender" element={<SurrenderPort />} />
          <Route path="/verify" element={<VerifyAntiFraud />} />
        </Routes>
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-500">
        Portus &mdash; Electronic Bill of Lading Protocol on IOTA
      </footer>
    </div>
  );
}
