const WEATHER_ICON_PATHS = {
  sun: '<circle cx="12" cy="12" r="4" class="i-sun"/><path class="i-sun" d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  moon: '<path class="i-moon" d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  sunSmall: '<circle cx="8" cy="8" r="3" class="i-sun"/><path class="i-sun" d="M8 2v1M2 8h1M3.76 3.76l.7.7M12.24 3.76l-.7.7"/>',
  moonSmall: '<path class="i-moon" d="M12 9.5A5 5 0 0 1 6.5 4a5 5 0 1 0 5.5 5.5Z"/>',
  cloud: '<path class="i-cloud" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  cloudLow: '<path class="i-cloud" d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" transform="translate(4.2 3.4) scale(0.8)"/>',
  cloudTop: '<path class="i-cloud" d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/>',
  fog: '<path class="i-cloud" d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/><path class="i-fog" d="M16 17H7M17 21H9"/>',
  rain: '<path class="i-rain" d="M16 14v6M8 14v6M12 16v6"/>',
  drizzle: '<path class="i-rain" d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>',
  snow: '<path class="i-snow" d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
  sleet: '<path class="i-rain" d="M8 14v3M16 14v3"/><path class="i-snow" d="M12 17h.01M8 21h.01M16 21h.01"/>',
  bolt: '<path class="i-bolt" d="m13 12-3 5h4l-3 5"/>',
};

const WEATHER_ICONS = {
  clear: (day) => (day ? ["sun"] : ["moon"]),
  partly: (day) => [day ? "sunSmall" : "moonSmall", "cloudLow"],
  cloud: () => ["cloud"],
  fog: () => ["fog"],
  drizzle: () => ["cloudTop", "drizzle"],
  rain: () => ["cloudTop", "rain"],
  sleet: () => ["cloudTop", "sleet"],
  snow: () => ["cloudTop", "snow"],
  storm: () => ["cloudTop", "bolt"],
};

function weatherIcon(kind, day) {
  const parts = (WEATHER_ICONS[kind] || WEATHER_ICONS.cloud)(day !== 0);
  const body = parts.map((part) => WEATHER_ICON_PATHS[part]).join("");
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}
