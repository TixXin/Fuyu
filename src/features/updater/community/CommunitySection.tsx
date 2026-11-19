import { useState } from "react";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { useLocale, useTranslation } from "../../../i18n";
import { openProjectLink } from "../api";
import { COMMUNITY_PAGE_URL, communityUrl, groupsFor, imageSourcesFrom, isExpired, type CommunityGroup, type CommunitySource } from "./communityGroups.ts";
import { useCommunityList } from "./useCommunityList.ts";
import "./CommunitySection.css";

function open(url: string) {
  void openProjectLink(url).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
}

function CommunityRow({ group, source }: { group: CommunityGroup; source: CommunitySource }) {
  const text = useTranslation().settings.project.community;
  const { locale } = useLocale();
  const [showing, setShowing] = useState(false);
  const [copy, setCopy] = useState<"copied" | "copyFailed" | null>(null);
  const [imageTry, setImageTry] = useState(0);
  const imageSource = imageSourcesFrom(source)[imageTry];
  const expired = isExpired(group);
  const app = text.platforms[group.platform];
  const name = group.name[locale];
  const details = [
    app,
    group.number ? text.number(group.number) : null,
    group.qr && group.expiresAt && !expired ? text.validUntil(group.expiresAt) : null,
  ].filter(Boolean).join(" · ");
  const description = group.note ? `${group.note[locale]} · ${details}` : details;

  async function copyNumber() {
    if (!group.number) return;
    try { await navigator.clipboard.writeText(group.number); setCopy("copied"); }
    catch { setCopy("copyFailed"); }
  }

  return (
    <SettingsRow
      title={name}
      description={description}
      searchable={false}
      control={
        <>
          {group.number && <SettingsLinkButton onClick={() => void copyNumber()}>{copy ? text[copy] : text.copyNumber}</SettingsLinkButton>}
          {group.link && <SettingsLinkButton onClick={() => open(group.link ?? "")}>{text.openLink}</SettingsLinkButton>}
          {group.qr && <SettingsLinkButton onClick={() => setShowing((value) => !value)}>{showing ? text.hideQr : text.showQr}</SettingsLinkButton>}
        </>
      }
    >
      {showing && group.qr && (
        <div className="community-qr">
          {expired ? (
            <p className="community-qr__expired" role="status">{text.expired}</p>
          ) : (
            <>
              {imageSource ? (
                <img
                  className="community-qr__image"
                  src={communityUrl(imageSource, group.qr)}
                  alt={text.qrAlt(name)}
                  width={180}
                  height={180}
                  onError={() => setImageTry((value) => value + 1)}
                />
              ) : (
                <p className="community-qr__expired" role="status">{text.imageFailed}</p>
              )}
              <span className="community-qr__hint">{text.scanHint(app)}</span>
            </>
          )}
        </div>
      )}
    </SettingsRow>
  );
}

export function CommunitySection() {
  const text = useTranslation().settings.project.community;
  const { locale } = useLocale();
  const { state, retry } = useCommunityList();
  const groups = state.status === "ready" ? groupsFor(state.list.groups, locale) : [];

  return (
    <SettingsGroup title={text.title}>
      {state.status === "loading" && <SettingsRow title={text.loading} searchable={false} />}
      {state.status === "failed" && (
        <SettingsRow
          title={text.failed}
          searchable={false}
          control={
            <>
              <SettingsLinkButton onClick={retry}>{text.retry}</SettingsLinkButton>
              <SettingsLinkButton onClick={() => open(COMMUNITY_PAGE_URL)}>{text.openPage}</SettingsLinkButton>
            </>
          }
        />
      )}
      {state.status === "ready" && groups.length === 0 && <SettingsRow title={text.empty} searchable={false} />}
      {state.status === "ready" && groups.map((group) => <CommunityRow key={group.id} group={group} source={state.list.source} />)}
    </SettingsGroup>
  );
}
