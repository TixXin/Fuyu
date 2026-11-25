import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { FolderOpen, Upload } from "lucide-react";
import { SettingsChoice } from "../../../components/settings/SettingsChoice";
import { SettingsFootnote } from "../../../components/settings/SettingsFootnote";
import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsInlineConfirm } from "../../../components/settings/SettingsInlineConfirm";
import { SettingsLinkButton } from "../../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../../components/settings/SettingsRow";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { useErrorText, useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { DEFAULT_FONT_SCALE, MAX_FONT_SCALE, MIN_FONT_SCALE } from "../../../lib/settings/settings";
import type { IslandFont, IslandSettings } from "../../../lib/settings/types";
import { importCustomFont, listCustomFonts, listenCustomFontsChanged, openCustomFontsFolder, removeCustomFont, type CustomFont } from "../../../lib/theme/api";
import { ACCEPTED_FONT_EXTENSIONS, customFontFaceName, MAX_CUSTOM_FONT_BYTES } from "../../../lib/theme/fonts";
import { ensureCustomFontLoaded, isCustomFontLoaded, subscribeLoadedCustomFonts, unloadCustomFont } from "../../../lib/theme/windowFont";
import { formatBytes } from "../../../utils/bytes";
import "./FontSettingsSection.css";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "done"; text: string } | { kind: "error"; text: string };

const ACCEPT_ATTR = ACCEPTED_FONT_EXTENSIONS.join(",");
const percent = (value: number) => `${Math.round(value)}%`;

function isAcceptedFontFile(fileName: string) {
  const lower = fileName.toLowerCase();
  return ACCEPTED_FONT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function FontSettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const errorText = useErrorText();
  const text = t.settings.appearance;
  const customText = text.customFonts;
  const inputRef = useRef<HTMLInputElement>(null);
  const [fonts, setFonts] = useState<CustomFont[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [, setLoadedVersion] = useState(0);

  const refresh = useCallback(() => {
    void listCustomFonts()
      .then((list) => {
        setFonts(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    let stop: (() => void) | undefined;
    let cancelled = false;
    void listenCustomFontsChanged(() => refresh())
      .then((unlisten) => (cancelled ? unlisten() : (stop = unlisten)))
      .catch(() => {});
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [refresh]);

  useEffect(() => subscribeLoadedCustomFonts(() => setLoadedVersion((value) => value + 1)), []);

  useEffect(() => {
    for (const font of fonts) {
      if (!isCustomFontLoaded(font.id)) void ensureCustomFontLoaded(font.id);
    }
  }, [fonts]);

  const builtinOptions = [
    { value: "system", label: text.systemFont },
    { value: "pixel", label: text.pixelFont },
    { value: "rounded", label: text.roundedFont },
    { value: "serif", label: text.serifFont },
    { value: "mono", label: text.monoFont },
  ] as const;

  const selectBuiltin = (fontFamily: IslandFont) => {
    onSettingsChange({ ...settings, fontFamily });
  };

  const applyLocalFont = (font: CustomFont) => {
    void ensureCustomFontLoaded(font.id);
    onSettingsChange({ ...settings, fontFamily: "custom", customFontId: font.id });
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!isAcceptedFontFile(file.name)) {
      setStatus({ kind: "error", text: customText.unsupportedFormat(file.name) });
      return;
    }
    if (file.size === 0 || file.size > MAX_CUSTOM_FONT_BYTES) {
      setStatus({ kind: "error", text: customText.tooLarge(file.name) });
      return;
    }
    setStatus({ kind: "busy" });
    try {
      const bytes = [...new Uint8Array(await file.arrayBuffer())];
      const imported = await importCustomFont({ fileName: file.name, bytes });
      await ensureCustomFontLoaded(imported.id);
      setFonts((current) => [...current.filter((item) => item.id !== imported.id), imported].sort((a, b) => a.name.localeCompare(b.name)));
      onSettingsChange({ ...settings, fontFamily: "custom", customFontId: imported.id });
      setStatus({ kind: "done", text: customText.imported(imported.name) });
    } catch (error) {
      setStatus({ kind: "error", text: errorText(error) });
    }
  };

  const handleRemove = (font: CustomFont) => {
    void removeCustomFont(font.id)
      .then(() => {
        unloadCustomFont(font.id);
        setFonts((current) => current.filter((item) => item.id !== font.id));
        if (settings.fontFamily === "custom" && settings.customFontId === font.id) {
          onSettingsChange({ ...settings, fontFamily: "system", customFontId: "" });
        }
      })
      .catch((error: unknown) => setStatus({ kind: "error", text: errorText(error) }));
  };

  const handleOpenFolder = () => {
    void openCustomFontsFolder().catch((error: unknown) => setStatus({ kind: "error", text: errorText(error) }));
  };

  const footer = (
    <>
      <SettingsFootnote text={customText.footer} />
      {status.kind === "done" && <p className="font-settings__status" role="status">{status.text}</p>}
      {status.kind === "error" && <p className="font-settings__error" role="alert">{status.text}</p>}
    </>
  );

  return (
    <SettingsGroup title={text.fontGroupTitle} footer={footer}>
      <SettingsRow
        title={text.fontStyle}
        control={
          <SettingsChoice<IslandFont>
            value={settings.fontFamily}
            options={builtinOptions}
            ariaLabel={text.fontLabel}
            onChange={selectBuiltin}
          />
        }
      />
      <SettingsSliderRow
        title={text.fontSize}
        description={text.fontSizeHint}
        value={settings.fontScale}
        min={MIN_FONT_SCALE}
        max={MAX_FONT_SCALE}
        step={1}
        format={percent}
        defaultValue={DEFAULT_FONT_SCALE}
        resetLabel={t.settings.layout.resetToDefault}
        onChange={(fontScale) => onSettingsChange({ ...settings, fontScale })}
      />
      <SettingsRow
        title={customText.importRow}
        description={customText.importHint}
        control={
          <span className="font-settings__actions">
            <SettingsLinkButton disabled={status.kind === "busy"} onClick={() => inputRef.current?.click()}>
              <Upload size={13} strokeWidth={2.2} aria-hidden="true" />
              {status.kind === "busy" ? customText.importing : customText.importAction}
            </SettingsLinkButton>
            <SettingsLinkButton onClick={handleOpenFolder}>
              <FolderOpen size={13} strokeWidth={2.2} aria-hidden="true" />
              {isMacOS ? customText.openFolderMac : customText.openFolder}
            </SettingsLinkButton>
            <input
              ref={inputRef}
              className="font-settings__input"
              type="file"
              accept={ACCEPT_ATTR}
              aria-label={customText.importAction}
              onChange={(event) => void handleImport(event)}
            />
          </span>
        }
      />
      {fonts.map((font) => {
        const active = settings.fontFamily === "custom" && settings.customFontId === font.id;
        const previewStyle = isCustomFontLoaded(font.id) ? { fontFamily: `"${customFontFaceName(font.id)}", var(--font-ui)` } : undefined;
        return (
          <SettingsRow
            key={font.id}
            searchable={false}
            indent
            title={<span style={previewStyle}>{font.name}</span>}
            description={`${font.format.toUpperCase()} · ${formatBytes(font.size)}`}
            control={
              <span className="font-settings__actions">
                {active ? (
                  <span className="font-settings__active">{customText.inUse}</span>
                ) : (
                  <SettingsLinkButton onClick={() => applyLocalFont(font)}>
                    {customText.use}
                  </SettingsLinkButton>
                )}
                <SettingsInlineConfirm
                  tone="danger"
                  confirmLabel={customText.removeConfirm}
                  hint={customText.confirmRemove(font.name)}
                  onConfirm={() => handleRemove(font)}
                >
                  {customText.remove}
                </SettingsInlineConfirm>
              </span>
            }
          />
        );
      })}
    </SettingsGroup>
  );
}
