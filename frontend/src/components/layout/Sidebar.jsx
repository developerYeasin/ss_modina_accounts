import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, Users, CalendarDays, BarChart3, Receipt,
  ShoppingCart, Truck, HandCoins, Boxes, Tags, Wallet, FileText, TrendingUp, AlertCircle,
  Settings as SettingsIcon, UserCog, Crown, Landmark, ArrowLeftRight, Wallet2, Store,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';

/** Primary nav. */
export const MAIN_NAV = [
  { to: '/', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { to: '/orders', label: 'অর্ডার', icon: ClipboardList },
  { to: '/customers', label: 'কাস্টমার', icon: Users },
  { to: '/sales', label: 'বিক্রয়', icon: TrendingUp },
  { to: '/dues', label: 'বাকি খাতা', icon: AlertCircle },
  { to: '/accounts', label: 'দৈনিক রিপোর্ট', icon: CalendarDays },
  { to: '/reports', label: 'রিপোর্ট', icon: BarChart3 },
];

export const MORE_NAV = [
  { to: '/payments', label: 'জমা / পেমেন্ট', icon: Wallet2 },
  { to: '/expenses', label: 'খরচ', icon: Receipt },
  { to: '/purchases', label: 'ক্রয়', icon: ShoppingCart },
  { to: '/suppliers', label: 'সরবরাহকারী', icon: Truck },
  { to: '/parties', label: 'পাশের দোকান / পার্টি', icon: Store },
  { to: '/owner', label: 'মালিকের হিসাব', icon: Crown },
  { to: '/bank', label: 'ব্যাংক', icon: Landmark },
  { to: '/branch-transfers', label: 'শাখা ট্রান্সফার', icon: ArrowLeftRight },
  { to: '/loans', label: 'ধার হিসাব', icon: HandCoins },
  { to: '/stock', label: 'স্টক', icon: Boxes },
  { to: '/price-lists', label: 'মূল্য তালিকা', icon: Tags },
  { to: '/salary', label: 'স্যালারি', icon: Wallet },
  { to: '/quotations', label: 'কোটেশন', icon: FileText },
  { to: '/settings', label: 'সেটিংস (দোকানের তথ্য ও খাত)', icon: SettingsIcon },
];

export const ADMIN_NAV = [
  { to: '/users', label: 'ইউজার', icon: UserCog },
];

function NavItem({ to, label, icon: Icon, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'border-primary bg-primary text-primary-foreground shadow-sm'
            : 'border-transparent text-sidebar-foreground hover:border-primary/20 hover:bg-primary/10 hover:text-primary',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate }) {
  const { setting } = useSettings();
  const { user, isAdmin } = useAuth();

  return (
    <div className="flex h-full flex-col border-r border-slate-200 bg-white">
      {/* brand */}
      <div className="flex items-center gap-3 border-b border-slate-200 p-4">
        {setting.logo_url ? (
          <img src={setting.logo_url} alt="logo" className="h-10 w-10 rounded-md object-contain" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            SS
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold text-sidebar-foreground">
            {setting.short_name || 'SS Modina হিসাব'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {setting.subtitle || 'Metal & Thai Glass'}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {MAIN_NAV.map((item) => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}

        <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          আরও
        </p>
        {MORE_NAV.map((item) => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}

        {isAdmin && (
          <>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              অ্যাডমিন
            </p>
            {ADMIN_NAV.map((item) => <NavItem key={item.to} {...item} onNavigate={onNavigate} />)}
          </>
        )}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <NavLink
          to="/settings/profile"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg border border-transparent p-2 hover:border-primary/20 hover:bg-primary/10"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold uppercase text-primary-foreground">
            {(user?.full_name || user?.email || '?').charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.email?.split('@')[0] || 'user'}</p>
            <p className="text-xs text-muted-foreground">{user?.role || 'user'}</p>
          </div>
        </NavLink>
      </div>
    </div>
  );
}
