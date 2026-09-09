import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Loading } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { SettingsProvider } from '@/hooks/useSettings';

import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';

const Orders = lazy(() => import('@/pages/Orders'));
const OrderForm = lazy(() => import('@/pages/OrderForm'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const OrderInvoice = lazy(() => import('@/pages/OrderInvoice'));
const Customers = lazy(() => import('@/pages/Customers'));
const CustomerForm = lazy(() => import('@/pages/CustomerForm'));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail'));
const CustomerStatement = lazy(() => import('@/pages/CustomerStatement'));
const DailyReport = lazy(() => import('@/pages/DailyReport'));
const Reports = lazy(() => import('@/pages/Reports'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const ExpenseForm = lazy(() => import('@/pages/ExpenseForm'));
const Purchases = lazy(() => import('@/pages/Purchases'));
const Suppliers = lazy(() => import('@/pages/Suppliers'));
const SupplierDetail = lazy(() => import('@/pages/SupplierDetail'));
const Loans = lazy(() => import('@/pages/Loans'));
const LoanDetail = lazy(() => import('@/pages/LoanDetail'));
const StockPage = lazy(() => import('@/pages/Stock'));
const PriceLists = lazy(() => import('@/pages/PriceLists'));
const SalaryPage = lazy(() => import('@/pages/Salary'));
const Payments = lazy(() => import('@/pages/Payments'));
const PaymentForm = lazy(() => import('@/pages/PaymentForm'));
const Quotations = lazy(() => import('@/pages/Quotations'));
const QuotationForm = lazy(() => import('@/pages/QuotationForm'));
const QuotationInvoice = lazy(() => import('@/pages/QuotationInvoice'));
const Calculators = lazy(() => import('@/pages/Calculators'));
const GlobalSearch = lazy(() => import('@/pages/GlobalSearch'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const Profile = lazy(() => import('@/pages/Profile'));
const UsersPage = lazy(() => import('@/pages/Users'));
const NotFound = lazy(() => import('@/pages/NotFound'));

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loading label="অ্যাপ চালু হচ্ছে…" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <SettingsProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />

          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />

            <Route path="orders" element={<Orders />} />
            <Route path="orders/new" element={<OrderForm />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="orders/:id/edit" element={<OrderForm />} />
            <Route path="orders/:id/invoice" element={<OrderInvoice />} />

            <Route path="customers" element={<Customers />} />
            <Route path="customers/new" element={<CustomerForm />} />
            <Route path="customers/:id" element={<CustomerDetail />} />
            <Route path="customers/:id/edit" element={<CustomerForm />} />
            <Route path="customers/:id/statement" element={<CustomerStatement />} />

            <Route path="accounts" element={<DailyReport />} />
            <Route path="reports" element={<Reports />} />

            <Route path="expenses" element={<Expenses />} />
            <Route path="expenses/new" element={<ExpenseForm />} />
            <Route path="expenses/:id/edit" element={<ExpenseForm />} />

            <Route path="purchases" element={<Purchases />} />
            <Route path="suppliers" element={<Suppliers />} />
            <Route path="suppliers/:id" element={<SupplierDetail />} />

            <Route path="loans" element={<Loans />} />
            <Route path="loans/:id" element={<LoanDetail />} />

            <Route path="stock" element={<StockPage />} />
            <Route path="price-lists" element={<PriceLists />} />
            <Route path="salary" element={<SalaryPage />} />

            <Route path="payments" element={<Payments />} />
            <Route path="payments/new" element={<PaymentForm />} />

            <Route path="quotations" element={<Quotations />} />
            <Route path="quotations/new" element={<QuotationForm />} />
            <Route path="quotations/:id/invoice" element={<QuotationInvoice />} />

            <Route path="materials" element={<Calculators />} />
            <Route path="calculator/:kind" element={<Calculators />} />

            <Route path="search" element={<GlobalSearch />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="settings/profile" element={<Profile />} />
            <Route path="users" element={<UsersPage />} />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </SettingsProvider>
  );
}
