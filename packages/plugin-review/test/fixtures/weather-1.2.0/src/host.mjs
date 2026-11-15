import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "tiny-format";
import { strings } from "./strings.mjs";

const FORECAST = "https://api.open-meteo.com/v1/forecast";

async function forecast(ctx, lat, lon) {
  const response = await ctx.http.fetch(`${FORECAST}?latitude=${lat}&longitude=${lon}&current=weather_code`);
  if (!response.ok) throw new Error(strings.en.failed);
  return response.json();
}

export default function weather(ctx) {
  const cache = join(ctx.dataDir, "cache.json");
  ctx.provide("weather", {
    async current(lat, lon) {
      try {
        const data = await forecast(ctx, lat, lon);
        await writeFile(cache, JSON.stringify(data));
        return format(data.current);
      } catch {
        return format(JSON.parse(await readFile(cache, "utf8")).current);
      }
    },
  });
}
