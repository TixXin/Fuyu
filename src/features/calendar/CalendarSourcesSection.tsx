import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useErrorText, useTranslation } from "../../i18n";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsSelect } from "../../components/settings/SettingsSelect";
import { useFlash } from "../../components/settings/useFlash";
import { addCalendarSource, getCalendarEvents, listCalendarSources, removeCalendarSource, type CalendarSource } from "./api";
import { addChinaHolidays, hasChinaHolidays } from "./holidays";
import { CALENDAR_PRESETS, guessKind, needsServer, presetOf, type CalendarService } from "./presets";
import { notifyCalendarRefresh } from "./storage";
import { SubCalendarList } from "./SubCalendarList";
import { useCalendarPrefs } from "./useCalendarPrefs";
import "./CalendarSourcesSection.css";

const EMPTY_FORM = { name: "", address: "", username: "", password: "" };

export function CalendarSourcesSection() {
  const text = useTranslation().settings.calendar;
  const errorText = useErrorText();
  const [prefs, setPrefs] = useCalendarPrefs();
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [service, setService] = useState<CalendarService>("feishu");
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, flashRefreshed] = useFlash<boolean>();
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

  const refreshSources = async () => {
    setRefreshing(true);
    try {
      await getCalendarEvents(true);
      await reload();
      notifyCalendarRefresh();
      flashRefreshed(true);
    } catch (error) {
      console.error("Failed to refresh calendars", error);
    } finally {
      setRefreshing(false);
    }
  };

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
          sources.length > 0 ? (
            <span className="calendar-source__header-actions">
              <SettingsLinkButton disabled={state.busy || refreshing} onClick={() => void refreshSources()}>
                {refreshed ? text.refreshed : refreshing ? text.refreshing : text.refreshNow}
              </SettingsLinkButton>
              <SettingsLinkButton disabled={holidaysAdded || state.busy} onClick={() => void run(() => addChinaHolidays(text.holidaysName))}>
                {holidaysAdded ? text.holidaysAdded : text.addHolidays}
              </SettingsLinkButton>
            </span>
          ) : (
            <SettingsLinkButton disabled={holidaysAdded || state.busy} onClick={() => void run(() => addChinaHolidays(text.holidaysName))}>
              {holidaysAdded ? text.holidaysAdded : text.addHolidays}
            </SettingsLinkButton>
          )
        }
      >
        {sources.map((source) => {
          const subs = source.calendars ?? [];
          const hasSubs = subs.length > 0;
          const expanded = expandedIds.has(source.id);
          const toggleExpand = () => {
            setExpandedIds((current) => {
              const next = new Set(current);
              if (next.has(source.id)) next.delete(source.id);
              else next.add(source.id);
              return next;
            });
          };
          return (
            <div key={source.id} className="calendar-source__block">
              <SettingsRow
                searchable={false}
                title={source.name}
                description={source.kind === "ics" ? text.icsFrom(source.host) : `${source.username} · ${source.host}`}
                control={
                  <span className="calendar-source__row-controls">
                    {hasSubs && (
                      <button
                        className="calendar-source__expand"
                        type="button"
                        aria-expanded={expanded}
                        onClick={toggleExpand}
                      >
                        {expanded ? <ChevronDown size={13} strokeWidth={2.2} aria-hidden="true" /> : <ChevronRight size={13} strokeWidth={2.2} aria-hidden="true" />}
                        {text.subCalendarsCount(subs.length)}
                      </button>
                    )}
                    <button className="calendar-source__remove" type="button" aria-label={text.remove(source.name)} onClick={() => void remove(source.id)}>
                      <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                  </span>
                }
              />
              {hasSubs && expanded && (
                <SubCalendarList calendars={subs} prefs={prefs} onPrefsChange={setPrefs} />
              )}
            </div>
          );
        })}
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
              <div className="calendar-form__actions">
                <button className="calendar-form__add" type="button" disabled={!ready || state.busy} onClick={() => void add()}>
                  {state.busy ? text.adding : text.addButton}
                </button>
                {sources.length > 0 && (
                  <SettingsLinkButton
                    disabled={state.busy}
                    onClick={() => {
                      setAdding(false);
                      setState({ busy: false, error: "" });
                    }}
                  >
                    {text.cancelAdd}
                  </SettingsLinkButton>
                )}
              </div>
            </div>
          </>
        )}
      </SettingsGroup>
    </>
  );
}
