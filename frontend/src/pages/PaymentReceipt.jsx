import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Payments } from '@/api/entities';
import { Button, Loading, ErrorState } from '@/components/ui';
import { PageHeader, PrintDoc, PrintTable, PrintTotals } from '@/components/shared';
import { bnDate, money, toBnDigits } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';

/**
 * জমা রসিদ — handed to the customer every time they pay part of a bill:
 * মোট বিল, আগে জমা, এবার জমা, এ পর্যন্ত মোট জমা, বাকি।
 */
export default function PaymentReceipt() {
  const { id } = useParams();
  const { currency } = useSettings();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['payment-receipt', id],
    queryFn: () => Payments.receipt(id),
  });

  if (isLoading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;

  const { payment, order, customer, history } = data;
  const back = order ? `/orders/${order.id}` : customer ? `/customers/${customer.id}` : '/payments';

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="জমা রসিদ"
          subtitle={`${payment.customer_name || ''} · ${bnDate(payment.date)}`}
          back={back}
          actions={
            <Button size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> প্রিন্ট
            </Button>
          }
        />
      </div>

      <PrintDoc
        title="জমা রসিদ / মানি রিসিট"
        copyLabel="গ্রাহক কপি"
        meta={[
          order && ['অর্ডার নং', order.order_number],
          ['কিস্তি', `${toBnDigits(data.installment)} নং জমা`],
          ['তারিখ', bnDate(payment.date)],
        ]}
        signatures={['গ্রাহকের স্বাক্ষর', 'টাকা গ্রহণকারী']}
      >
        <section className="print-parties">
          <div>
            <p className="print-party-label">কাস্টমারের তথ্য</p>
            <p className="print-party-name">{payment.customer_name || customer?.name || '—'}</p>
            <p>মোবাইল: {customer?.mobile || order?.customer_mobile || '—'}</p>
            <p>ঠিকানা: {customer?.address || customer?.village || '—'}</p>
          </div>
          <div>
            <p className="print-party-label">জমার তথ্য</p>
            <p>মাধ্যম: {payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</p>
            <p>গ্রহণকারী: {payment.received_by || '—'}</p>
            {order?.description && <p>কাজ: {order.description}</p>}
            {payment.notes && <p>নোট: {payment.notes}</p>}
          </div>
        </section>

        <PrintTable
          head={[
            { label: 'ক্র.', width: '40px', align: 'center' },
            { label: 'জমার তারিখ' },
            { label: 'মাধ্যম', width: '110px' },
            { label: 'টাকা', align: 'right', width: '130px' },
          ]}
        >
          {history.map((p, i) => (
            <tr key={p.id} style={p.id === payment.id ? { fontWeight: 700 } : undefined}>
              <td className="num" style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>{bnDate(p.date)}{p.id === payment.id ? ' (এই রসিদ)' : ''}</td>
              <td>{p.method}</td>
              <td className="num" style={{ textAlign: 'right' }}>{money(p.amount, currency)}</td>
            </tr>
          ))}
        </PrintTable>

        <PrintTotals
          rows={[
            { label: order ? 'মোট বিল' : 'মোট বিল (সব অর্ডার)', value: money(data.bill_total, currency) },
            { label: 'আগে জমা', value: money(data.paid_before, currency) },
            { label: 'এবার জমা', value: money(payment.amount, currency), strong: true },
            { label: 'এ পর্যন্ত মোট জমা', value: money(data.paid_upto, currency) },
            { label: 'বাকি রইল', value: money(Math.max(data.remaining, 0), currency), danger: true },
          ]}
        />
      </PrintDoc>
    </div>
  );
}
