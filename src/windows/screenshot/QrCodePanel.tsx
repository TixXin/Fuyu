import { Copy, ExternalLink } from "lucide-react";
import type { ScreenshotQrCode } from "../../features/screenshot/api";
import { webLink } from "../../features/screenshot/qrText";
import { useTranslation } from "../../i18n";

export function QrCodePanel({ codes, onCopy, onOpen }: { codes: readonly ScreenshotQrCode[]; onCopy: (text: string) => void; onOpen: (url: string) => void }) {
  const t = useTranslation().screenshot.qr;
  return (
    <div className="screenshot-overlay__qr" role="group" aria-label={t.title}>
      {codes.map((code) => {
        const link = webLink(code.text);
        return (
          <div key={code.text} className="screenshot-overlay__qr-item">
            <span className="screenshot-overlay__qr-kind">{link ? t.link : t.text}</span>
            <span className="screenshot-overlay__qr-text">{code.text}</span>
            <span className="screenshot-overlay__qr-actions">
              {link && (
                <button type="button" className="screenshot-overlay__qr-button" onClick={() => onOpen(link)}>
                  <ExternalLink size={14} />
                  {t.open}
                </button>
              )}
              <button type="button" className="screenshot-overlay__qr-button" onClick={() => onCopy(code.text)}>
                <Copy size={14} />
                {t.copy}
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
