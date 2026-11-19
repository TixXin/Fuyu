import { openIndex } from "../../../../packages/plugin-market/src/index.mjs";
import { marketError } from "./marketStore.mjs";

export const INDEX_TIMEOUT_MS = 15 * 1000;

export function fetchVerifiedIndex({ downloader, indexUrl, trust, lastSerial, now }) {
  return downloader.run(indexUrl, async (source) => {
    const [index, sig] = await Promise.all([
      source.get(indexUrl, { timeoutMs: INDEX_TIMEOUT_MS }),
      source.get(`${indexUrl}.sig`, { timeoutMs: INDEX_TIMEOUT_MS }),
    ]);
    if (index.missing || sig.missing) throw marketError("network", `the index or its signature is missing (${index.missing ? 404 : 200}/${sig.missing ? 404 : 200})`);
    let signature;
    try {
      signature = JSON.parse(sig.text);
    } catch {
      throw marketError("bad-signature", "Market index signature is not valid JSON");
    }
    const opened = openIndex({ text: index.text, signature, trust, lastSerial, now });
    if (opened.status !== "ok") throw marketError(opened.reason ?? opened.status, `Market index rejected: ${opened.reason ?? opened.status}`);
    return { text: index.text, signature, doc: opened.doc };
  }, "the market index");
}
