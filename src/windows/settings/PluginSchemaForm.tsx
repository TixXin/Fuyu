import { useCallback, useEffect, useId, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RotateCcw } from "lucide-react";
import {
  pluginConfigV1,
  type PluginConfigEntry,
  type PluginConfigPropertySchema,
  type PluginConfigValues,
} from "@fuyu/plugin-services";
import { SettingsSwitch } from "../../components/settings/SettingsSwitch";
import { windowServices } from "../../features/plugin-kernel/services";
import { useErrorText, useLocale, useTranslation } from "../../i18n";

const pluginConfigClient = windowServices.get(pluginConfigV1);

function resolveSchemaText(
  value: string | Record<string, string> | undefined,
  locale: string,
  fallback: string,
): string {
  if (typeof value === "object" && value !== null) {
    return value[locale] ?? value.en ?? value["zh-CN"] ?? fallback;
  }
  return value ?? fallback;
}

function buildDrafts(
  properties: Record<string, PluginConfigPropertySchema>,
  values: PluginConfigValues,
  defaults: PluginConfigValues,
): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const [key, prop] of Object.entries(properties)) {
    const current = values[key] ?? defaults[key] ?? prop.default;
    drafts[key] = current === undefined || current === null ? "" : String(current);
  }
  return drafts;
}

export function PluginSchemaForm({ pluginId }: { pluginId: string }) {
  const { locale } = useLocale();
  const copy = useTranslation().settings.pluginsV3.schemaForm;
  const errorText = useErrorText();
  const baseId = useId();

  const [entry, setEntry] = useState<PluginConfigEntry | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const applyEntry = useCallback((next: PluginConfigEntry) => {
    setEntry(next);
    const props = next.schema?.properties;
    if (props) {
      setDrafts(buildDrafts(props, next.values, next.defaults));
    }
  }, []);

  useEffect(() => {
    let live = true;
    const load = () => {
      void pluginConfigClient
        .get({ id: pluginId })
        .then((res) => {
          if (!live) return;
          applyEntry(res);
        })
        .catch(() => {
          if (live) setEntry(null);
        });
    };
    load();
    const offWatch = windowServices.watch(load);
    const offChanged = pluginConfigClient.on("changed", (data) => {
      if (!live || data.id !== pluginId) return;
      setEntry((prev) => {
        if (!prev) return prev;
        const props = prev.schema?.properties;
        if (props) setDrafts(buildDrafts(props, data.values, prev.defaults));
        return { ...prev, values: data.values };
      });
    });
    return () => {
      live = false;
      offWatch();
      void offChanged();
    };
  }, [applyEntry, pluginId]);

  const properties = entry?.schema?.properties;
  if (!entry || !properties) return null;
  const entries = Object.entries(properties);
  if (entries.length === 0) return null;

  const busy = savingKey !== null || resetting;

  const saveValue = (key: string, value: PluginConfigValues[string]) => {
    setSavingKey(key);
    setValidationError(null);
    void pluginConfigClient
      .set({ id: pluginId, values: { [key]: value } })
      .then((res) => applyEntry(res))
      .catch((failure: unknown) => setValidationError(errorText(failure)))
      .finally(() => setSavingKey(null));
  };

  const commitNumber = (key: string, prop: PluginConfigPropertySchema) => {
    const raw = (drafts[key] ?? "").trim();
    const current = entry.values[key] ?? entry.defaults[key] ?? prop.default;
    if (raw === "") {
      setDrafts((prev) => ({
        ...prev,
        [key]: current === undefined || current === null ? "" : String(current),
      }));
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      saveValue(key, raw);
      return;
    }
    if (parsed === current) return;
    saveValue(key, parsed);
  };

  const commitString = (key: string, prop: PluginConfigPropertySchema) => {
    const next = drafts[key] ?? "";
    const current = entry.values[key] ?? entry.defaults[key] ?? prop.default;
    const currentStr = current === undefined || current === null ? "" : String(current);
    if (next === currentStr) return;
    saveValue(key, next);
  };

  const resetDefaults = () => {
    setResetting(true);
    setValidationError(null);
    void pluginConfigClient
      .reset({ id: pluginId })
      .then((res) => applyEntry(res))
      .catch((failure: unknown) => setValidationError(errorText(failure)))
      .finally(() => setResetting(false));
  };

  const handleEnter = (event: ReactKeyboardEvent<HTMLInputElement>, commit: () => void) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    commit();
  };

  return (
    <section className="plugins-v3__schema-form" data-plugin-schema-form={pluginId}>
      <div className="plugins-v3__subhead">
        <h4 className="plugins-v3__subheading">{copy.heading}</h4>
        <button
          className="plugins-v3__btn"
          type="button"
          disabled={busy}
          data-action="reset-plugin-config"
          onClick={resetDefaults}
        >
          <RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />
          <span>{resetting ? copy.resettingBtn : copy.resetBtn}</span>
        </button>
      </div>

      {validationError ? (
        <p className="plugins-v3__error-banner" data-schema-error="">
          {validationError}
        </p>
      ) : null}

      <div className="plugins-v3__schema-list">
        {entries.map(([key, prop]) => {
          const fieldId = `${baseId}-${key}`;
          const label = resolveSchemaText(prop.title, locale, key);
          const desc = resolveSchemaText(prop.description, locale, "");
          const effective = entry.values[key] ?? entry.defaults[key] ?? prop.default;

          return (
            <div key={key} className="plugins-v3__schema-row" data-schema-field={key}>
              <div className="plugins-v3__schema-copy">
                <label className="plugins-v3__schema-label" htmlFor={fieldId}>
                  {label}
                </label>
                {desc ? <span className="plugins-v3__schema-desc">{desc}</span> : null}
              </div>
              <div className="plugins-v3__schema-control">
                {prop.type === "boolean" ? (
                  <SettingsSwitch
                    id={fieldId}
                    checked={Boolean(effective)}
                    disabled={busy}
                    onChange={(checked) => saveValue(key, checked)}
                  />
                ) : Array.isArray(prop.enum) ? (
                  <select
                    id={fieldId}
                    className="plugins-v3__schema-select"
                    value={effective === undefined || effective === null ? "" : String(effective)}
                    disabled={busy}
                    onChange={(e) => {
                      const raw = e.currentTarget.value;
                      const matched = prop.enum?.find((item) => String(item) === raw);
                      saveValue(key, matched !== undefined ? matched : raw);
                    }}
                  >
                    {prop.enum.map((option) => (
                      <option key={String(option)} value={String(option)}>
                        {String(option)}
                      </option>
                    ))}
                  </select>
                ) : prop.type === "number" || prop.type === "integer" ? (
                  <input
                    id={fieldId}
                    className="plugins-v3__schema-input"
                    type="number"
                    min={prop.minimum}
                    max={prop.maximum}
                    step={prop.type === "integer" ? 1 : "any"}
                    value={drafts[key] ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.currentTarget.value;
                      setDrafts((prev) => ({ ...prev, [key]: next }));
                    }}
                    onBlur={() => commitNumber(key, prop)}
                    onKeyDown={(e) => handleEnter(e, () => commitNumber(key, prop))}
                  />
                ) : (
                  <input
                    id={fieldId}
                    className="plugins-v3__schema-input"
                    type="text"
                    value={drafts[key] ?? ""}
                    disabled={busy}
                    onChange={(e) => {
                      const next = e.currentTarget.value;
                      setDrafts((prev) => ({ ...prev, [key]: next }));
                    }}
                    onBlur={() => commitString(key, prop)}
                    onKeyDown={(e) => handleEnter(e, () => commitString(key, prop))}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
