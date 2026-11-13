import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { addCalendarSource, listCalendarSources, removeCalendarSource, type CalendarSource } from "./api";
import { CALENDAR_PRESETS, guessKind, needsServer, presetOf, type CalendarService } from "./presets";
import { addChinaHolidays, hasChinaHolidays } from "./holidays";
import "./CalendarSourcesSection.css";

const EMPTY_FORM = { name: "", address: "", username: "", password: "" };

export function CalendarSourcesSection() {
  const text = useTranslation().settings.calendar;
  const errorText = useErrorText();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [service, setService] = useState<CalendarService>("feishu");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [state, setState] = useState<{ busy: boolean; error: string }>({ busy: false, error: "" });

  const reload = useCallback(async () => {
    try {
      const listed = await listCalendarSources();
      setSources(Array.isArray(listed) ? listed : []);
    } catch (error) {
      console.error("Failed to list calendars", error);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const preset = presetOf(service);
  const kind = service === "other" ? guessKind(form.address) : preset.kind;
  const askServer = needsServer(preset, kind);
  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setState({ busy: true, error: "" });
    try {
      await action();
      after?.();
      setState({ busy: false, error: "" });
      await reload();
    } catch (error) {
      setState({ busy: false, error: errorText(error) });
    }
  };
  const add = () =>
    run(
      () =>
        addCalendarSource({
          kind,
          name: form.name.trim() || text.services[service],
          url: kind === "caldav" ? (askServer ? form.address : preset.server) : "",
          username: form.username,
          secret: kind === "ics" ? form.address : form.password,
        }),
      () => {
        setForm(EMPTY_FORM);
        setAdding(false);
      },
    );
  const remove = async (id: string) => {
    try {
      await removeCalendarSource(id);
    } catch (error) {
      console.error("Failed to remove the calendar", error);
    }
    await reload();
  };
  const field = (key: keyof typeof EMPTY_FORM, label: string, placeholder: string, type = "text") => (
    <label className="calendar-form__field">
      <span>{label}</span>
      <input
        type={type}
        value={form[key]}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => setForm({ ...form, [key]: event.currentTarget.value })}
      />
    </label>
  );
  const ready =
    kind === "ics" ? form.address.trim() !== "" : form.username.trim() !== "" && form.password.trim() !== "" && (!askServer || form.address.trim() !== "");
  const holidaysAdded = hasChinaHolidays(sources);
  const showForm = adding || sources.length === 0;

  return (
    <>
      <SettingsGroup
        title={text.sources}
        action={
          <SettingsLinkButton disabled={holidaysAdded || state.busy} onClick={() => void run(() => addChinaHolidays(text.holidaysName))}>
            {holidaysAdded ? text.holidaysAdded : text.addHolidays}
          </SettingsLinkButton>
        }
      >
        {sources.map((source) => (
          <SettingsRow searchable={false}
            key={source.id}
            title={source.name}
            description={source.kind === "ics" ? text.icsFrom(source.host) : `${source.username} · ${source.host}`}
            control={
              <button className="calendar-source__remove" type="button" aria-label={text.remove(source.name)} onClick={() => void remove(source.id)}>
                <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
              </button>
            }
          />
        ))}
        {!showForm && (
          <SettingsRow
            searchable={false}
            title=""
            control={<SettingsLinkButton onClick={() => setAdding(true)}><Plus size={13} strokeWidth={2.2} aria-hidden="true" />{text.add}</SettingsLinkButton>}
          />
        )}
        {showForm && sources.length === 0 && <SettingsRow searchable={false} title={<span className="calendar-source__empty">{text.noSources}</span>} />}
        {showForm && (
          <>
            <SettingsRow
              title={text.service}
              control={
                <SettingsSelect
                  value={service}
                  ariaLabel={text.service}
                  options={CALENDAR_PRESETS.map((option) => ({ value: option.service, label: text.services[option.service] }))}
                  onChange={(next) => {
                    setService(next);
                    setState({ busy: false, error: "" });
                  }}
                />
              }
            />
            <div className="calendar-form">
              <ol className="calendar-form__steps">
                {text.steps[service].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {kind === "ics" || service === "other"
                ? field("address", service === "other" ? text.addressOrLink : text.link, service === "other" ? text.addressOrLinkPlaceholder : "https://…", kind === "ics" && service !== "other" ? "password" : "text")
                : askServer && field("address", text.server, "https://…")}
              {kind === "caldav" && (
                <>
                  {field("username", text.username, "")}
                  {field("password", text.password, "", "password")}
                </>
              )}
              {field("name", text.name, text.services[service])}
              {state.error && (
                <p className="calendar-form__error" role="alert">
                  {state.error}
                </p>
              )}
              <button className="calendar-form__add" type="button" disabled={!ready || state.busy} onClick={() => void add()}>
                {state.busy ? text.adding : text.addButton}
              </button>
            </div>
          </>
        )}
      </SettingsGroup>
    </>
  );
}
