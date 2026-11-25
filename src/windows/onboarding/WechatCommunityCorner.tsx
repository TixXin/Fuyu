import { useState, type RefObject } from "react";
import { X } from "lucide-react";
import { communityUrl, groupsFor, imageSourcesFrom, isExpired } from "../../features/updater/community/communityGroups";
import { useCommunityList } from "../../features/updater/community/useCommunityList";
import { useLocale, useTranslation } from "../../i18n";
import "./WechatCommunityCorner.css";

export function WechatCommunityCorner({
  cornerRef,
  visible,
  zoomed,
  onZoomChange,
}: {
  cornerRef: RefObject<HTMLDivElement | null>;
  visible: boolean;
  zoomed: boolean;
  onZoomChange: (open: boolean) => void;
}) {
  const { locale } = useLocale();
  const text = useTranslation().onboarding.community;
  const { state } = useCommunityList();
  const [collapsed, setCollapsed] = useState(false);
  const [imageTry, setImageTry] = useState(0);

  if (!visible || state.status !== "ready") return null;

  const candidates = groupsFor(state.list.groups, locale);
  const wechat = candidates.find((group) => group.platform === "wechat" && group.qr && !isExpired(group));
  if (!wechat || !wechat.qr) return null;

  const sources = imageSourcesFrom(state.list.source);
  const source = sources[imageTry];
  if (!source) return null;

  const qrUrl = communityUrl(source, wechat.qr);
  const groupName = wechat.name[locale] || text.title;

  return (
    <>
      <div
        ref={cornerRef}
        className={collapsed ? "wechat-corner wechat-corner--collapsed" : "wechat-corner"}
        role="button"
        tabIndex={0}
        aria-label={collapsed ? text.collapsed : `${groupName} · ${text.sub}`}
        onClick={() => {
          if (collapsed) setCollapsed(false);
          else onZoomChange(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (collapsed) setCollapsed(false);
            else onZoomChange(true);
          }
        }}
      >
        {collapsed ? (
          <>
            <span className="wechat-corner__dot" aria-hidden="true" />
            <span className="wechat-corner__collapsed-label">{text.collapsed}</span>
          </>
        ) : (
          <>
            <span className="wechat-corner__qr">
              <img src={qrUrl} alt={text.qrAlt} width={64} height={64} onError={() => setImageTry((value) => value + 1)} />
            </span>
            <span className="wechat-corner__meta">
              <span className="wechat-corner__head">
                <span className="wechat-corner__title">
                  <span className="wechat-corner__dot" aria-hidden="true" />
                  {groupName}
                </span>
                <button
                  type="button"
                  className="wechat-corner__hide"
                  onClick={(event) => {
                    event.stopPropagation();
                    setCollapsed(true);
                    onZoomChange(false);
                  }}
                >
                  {text.hide}
                </button>
              </span>
              <span className="wechat-corner__sub">{text.sub}</span>
            </span>
          </>
        )}
      </div>

      {zoomed && (
        <div
          className="wechat-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={text.modalTitle}
          onClick={(event) => {
            if (event.target === event.currentTarget) onZoomChange(false);
          }}
        >
          <div className="wechat-lightbox__card">
            <button type="button" className="wechat-lightbox__close" aria-label={text.close} onClick={() => onZoomChange(false)}>
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <div className="wechat-lightbox__title">
              <span className="wechat-corner__dot" aria-hidden="true" />
              {text.modalTitle}
            </div>
            <div className="wechat-lightbox__img">
              <img src={qrUrl} alt={text.qrAlt} width={280} height={280} onError={() => setImageTry((value) => value + 1)} />
            </div>
            <p className="wechat-lightbox__hint">
              {text.modalHint}
              {wechat.expiresAt ? ` · ${text.validUntil(wechat.expiresAt)}` : ""}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
