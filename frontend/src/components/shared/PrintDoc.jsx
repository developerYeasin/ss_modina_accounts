import { Printer } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettings } from '@/hooks/useSettings';
import { bnDate } from '@/lib/utils';

/**
 * The house style for every printed paper — invoice, statement, salary sheet,
 * daily report. One frame so all of them leave the printer looking like they
 * came from the same shop: crested header, the shop logo as a centred জল-ছাপ,
 * a titled document band, and signature lines.
 *
 *   <PrintDoc title="ক্যাশ মেমো" meta={[['নং', '…'], ['তারিখ', '…']]}>…</PrintDoc>
 */
export function PrintDoc({
  title,
  copyLabel,
  meta = [],
  children,
  footerNote,
  signatures = ['গ্রাহকের স্বাক্ষর', 'অনুমোদিত স্বাক্ষর'],
  onPrint,
}) {
  const { setting } = useSettings();
  const note = footerNote === undefined ? setting?.invoice_footer : footerNote;

  return (
    <div className="print-area print-sheet mx-auto max-w-4xl bg-white text-black">
      {/* Watermark — the shop crest, faint, behind everything. */}
      {setting?.logo_url && (
        <img src={setting.logo_url} alt="" aria-hidden="true" className="print-watermark" />
      )}

      <div className="print-sheet-inner">
        {/* ---- crested header ---- */}
        <header className="print-head">
          <div className="flex items-center gap-4">
            {setting?.logo_url && (
              <img src={setting.logo_url} alt="logo" className="print-logo" />
            )}
            <div className="min-w-0">
              <h1 className="print-shop-name">{setting?.business_name}</h1>
              {setting?.subtitle && <p className="print-shop-sub">{setting.subtitle}</p>}
              <p className="print-shop-line">{setting?.address}</p>
              <p className="print-shop-line">
                {setting?.phone && <>মোবাইল: {setting.phone}</>}
                {setting?.proprietor && <> · প্রোঃ {setting.proprietor} {setting.proprietor_phone || ''}</>}
                {setting?.manager && <> · ম্যানেজার: {setting.manager} {setting.manager_phone || ''}</>}
              </p>
            </div>
          </div>
          {copyLabel && <span className="print-copy-tag">{copyLabel}</span>}
        </header>

        {/* ---- document band: what this paper is, and its key facts ---- */}
        <div className="print-title-band">
          <h2 className="print-doc-title">{title}</h2>
          <dl className="print-meta">
            {meta.filter(Boolean).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className="num">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="print-body">{children}</div>

        {/* ---- signatures ---- */}
        {signatures?.length > 0 && (
          <div className="print-signatures">
            {signatures.map((s) => (
              <div key={s}>
                <div className="print-sign-line" />
                <p>{s}</p>
              </div>
            ))}
          </div>
        )}

        <footer className="print-foot">
          {/* An empty footerNote means "no shop line here" — a daily sheet is
              not the place for the invoice's delivery terms. */}
          {note && <p className="print-foot-note">{note}</p>}
          <p className="print-foot-fine">
            {setting?.business_name} · {setting?.phone} · {bnDate(new Date())} — কম্পিউটারে তৈরি কাগজ
          </p>
        </footer>
      </div>

      {onPrint && (
        <div className="no-print mt-4 flex justify-center">
          <Button size="sm" onClick={onPrint}>
            <Printer className="h-4 w-4" /> প্রিন্ট
          </Button>
        </div>
      )}
    </div>
  );
}

/** The bordered money table every paper uses for its lines. */
export const PrintTable = ({ head, children, foot }) => (
  <div className="overflow-x-auto">
    <table className="print-table">
      <thead>
        <tr>{head.map((h) => (
          <th key={h.label} style={{ textAlign: h.align || 'left', width: h.width }}>{h.label}</th>
        ))}</tr>
      </thead>
      <tbody>{children}</tbody>
      {foot}
    </table>
  </div>
);

/** Right-hand totals stack: label on the left, money on the right. */
export const PrintTotals = ({ rows }) => (
  <div className="print-totals">
    <dl>
      {rows.filter(Boolean).map(({ label, value, strong, danger }) => (
        <div key={label} className={[strong ? 'strong' : '', danger ? 'danger' : ''].join(' ').trim()}>
          <dt>{label}</dt>
          <dd className="num">{value}</dd>
        </div>
      ))}
    </dl>
  </div>
);
