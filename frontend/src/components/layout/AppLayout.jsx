import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, LogOut, Plus } from 'lucide-react';
import Sidebar from './Sidebar';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { setting } = useSettings();

  // Close the drawer on navigation and scroll each screen to the top.
  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="relative min-h-screen">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block print:hidden">
        <Sidebar />
      </aside>

      {/* mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 animate-slide-in">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative lg:pl-60 print:pl-0">
        {/* top bar — mobile only, plus quick actions everywhere */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/95 px-3 shadow-sm lg:px-8 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="মেনু"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link to="/" className="font-heading text-sm font-bold lg:hidden">
            {setting.short_name || 'SS Modina হিসাব'}
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" onClick={() => navigate('/orders/new')} className="hidden sm:inline-flex">
              <Plus className="h-4 w-4" /> নতুন অর্ডার
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="লগআউট">
              <LogOut className="h-4.5 w-4.5" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl animate-fade-in px-4 py-4 pb-24 lg:px-8 lg:py-6 lg:pb-8 print:max-w-none print:px-0 print:py-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
