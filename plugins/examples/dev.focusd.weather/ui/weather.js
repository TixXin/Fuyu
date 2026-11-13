const fuyu = (window.acquireFuyuApi || window.acquireFocusdApi)();
const locale = fuyu.locale === "zh-CN" ? "zh-CN" : "en";
const $ = (id) => document.getElementById(id);
let strings = null;
let latest = fuyu.getState();

function text(key, values = {}) {
  let value = strings.text[locale][key] || "";
  for (const [name, replacement] of Object.entries(values)) value = value.replace(`{${name}}`, replacement);
  return value;
}

function condition(code, index) {
  const entry = strings.codes[String(code)];
  return entry ? entry[locale][index] : text("unknown");
}

function iconFor(code, day) {
  const entry = strings.codes[String(code)];
  return weatherIcon(entry ? entry.icon : "cloud", day);
}

const temp = (value) => (value == null ? "–" : `${Math.round(value)}°`);

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content != null) node.textContent = content;
  return node;
}

function dayLabel(date, today, index) {
  if (index === 0 || date === today) return text("today");
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(year, month - 1, day));
}

function showMessage(title, body, kind) {
  $("weather").hidden = true;
  $("message").hidden = false;
  $("message").dataset.kind = kind;
  $("message-icon").innerHTML = weatherIcon(kind === "empty" ? "partly" : "cloud", 1);
  $("message-title").textContent = title;
  $("message-body").textContent = body;
}

function renderNow(forecast) {
  const now = forecast.current;
  const today = forecast.daily[0] || {};
  $("now-icon").innerHTML = iconFor(now.code, now.day);
  $("now-temp").textContent = temp(now.temp);
  $("now-condition").textContent = condition(now.code, 1);
  $("now-range").textContent = text("range", { max: temp(today.max), min: temp(today.min) });
  const facts = [
    [text("feels"), temp(now.feels)],
    [text("humidity"), now.humidity == null ? "–" : `${Math.round(now.humidity)}%`],
    [text("wind"), now.wind == null ? "–" : `${Math.round(now.wind)} km/h`],
  ];
  $("now-facts").replaceChildren(
    ...facts.map(([label, value]) => {
      const row = element("div", "fact");
      row.append(element("dt", null, label), element("dd", null, value));
      return row;
    }),
  );
}

function renderHours(hours) {
  $("hours").replaceChildren(
    ...hours.map((hour, index) => {
      const item = element("li", "hour");
      item.append(element("span", "hour__time", index === 0 ? text("now") : hour.time.slice(11, 16)));
      const icon = element("span", "hour__icon");
      icon.innerHTML = iconFor(hour.code, hour.day);
      item.append(icon, element("strong", "hour__temp", temp(hour.temp)));
      item.append(element("span", "hour__pop", hour.pop >= 20 ? `${hour.pop}%` : ""));
      return item;
    }),
  );
}

function renderDays(days, today) {
  const lows = days.map((day) => day.min).filter((value) => value != null);
  const highs = days.map((day) => day.max).filter((value) => value != null);
  const bottom = Math.min(...lows);
  const span = Math.max(Math.max(...highs) - bottom, 1);
  $("days").replaceChildren(
    ...days.map((day, index) => {
      const row = element("li", "day");
      row.append(element("span", "day__name", dayLabel(day.date, today, index)));
      const icon = element("span", "day__icon");
      icon.innerHTML = iconFor(day.code, 1);
      icon.title = condition(day.code, 1);
      row.append(icon, element("span", "day__pop", day.pop >= 20 ? `${day.pop}%` : ""));
      row.append(element("span", "day__min", temp(day.min)));
      const track = element("span", "day__track");
      const fill = element("span", "day__fill");
      fill.style.left = `${((day.min - bottom) / span) * 100}%`;
      fill.style.width = `${Math.max(((day.max - day.min) / span) * 100, 4)}%`;
      track.append(fill);
      row.append(track, element("span", "day__max", temp(day.max)));
      return row;
    }),
  );
}

function render(message) {
  if (!strings) return;
  $("refresh").classList.remove("is-busy");
  if (!message) return showMessage(text("loading"), "", "loading");
  if (!message.city) return showMessage(text("emptyTitle"), text("emptyBody"), "empty");
  if (!message.forecast) {
    return message.problem ? showMessage(message.problem, "", "problem") : showMessage(text("loading"), "", "loading");
  }
  $("message").hidden = true;
  $("weather").hidden = false;
  const place = message.place || {};
  $("place").textContent = place.name || message.city;
  $("region").textContent = [place.region, place.country].filter(Boolean).filter((part) => part !== place.name).join(" · ");
  const fetched = new Date(message.fetchedAt);
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(fetched);
  $("updated").textContent = text("updated", { time });
  $("problem").hidden = !message.problem;
  $("problem").textContent = message.problem ? `${message.problem} · ${text("stale")}` : "";
  const forecast = message.forecast;
  renderNow(forecast);
  renderHours(forecast.hourly || []);
  renderDays(forecast.daily || [], (forecast.now || "").slice(0, 10));
}

fuyu.onMessage((message) => {
  if (!message || message.type !== "weather") return;
  latest = message;
  fuyu.setState(message);
  render(message);
});

$("refresh").addEventListener("click", () => {
  $("refresh").classList.add("is-busy");
  fuyu.postMessage({ type: "refresh" });
});

fetch("strings.json")
  .then((response) => response.json())
  .then((loaded) => {
    strings = loaded;
    document.documentElement.lang = locale;
    $("refresh").title = text("refresh");
    $("refresh").setAttribute("aria-label", text("refresh"));
    $("hourly-title").textContent = text("hourly");
    $("daily-title").textContent = text("daily");
    render(latest);
    fuyu.postMessage({ type: "ready", locale });
  });
