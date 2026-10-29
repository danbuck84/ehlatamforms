import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { APP_CONFIG } from '../../config/app';

export function ShareScreen() {
  const [copied, setCopied] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const url = typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://englishtalk.netlify.app/';

  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 340,
      margin: 2,
      color: { dark: '#121214', light: '#FFFFFF' },
    }).then(setQrSvg);
  }, [url]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center shadow-xl sm:p-10">
      <h2 className="text-2xl font-bold text-[var(--text)]">Check in at {APP_CONFIG.APP_NAME}</h2>
      <p className="mt-1 text-xs text-[var(--text-secondary)] sm:text-sm">{APP_CONFIG.CO_BRAND}</p>

      <div className="mx-auto my-6 flex h-72 w-72 items-center justify-center rounded-2xl bg-white p-4 shadow-inner sm:h-80 sm:w-80">
        {qrSvg ? (
          <img src={qrSvg} alt="QR code for student check-in" className="h-full w-full" />
        ) : (
          <span className="text-sm text-gray-500">Generating QR...</span>
        )}
      </div>

      <p className="break-all font-mono text-base font-bold text-[var(--primary)]">{url}</p>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
        >
          {copied ? '✅ Copied!' : '📋 Copy permanent check-in link'}
        </button>
      </div>
    </section>
  );
}
