import { ATOMS, canAppend, reverseChain, solve, type Atom, type Gender } from "../kinship.ts";
import { ATOM_LABEL, describeChain, lookupTitle } from "../kinshipTitles.ts";
import { locale, text } from "../text.ts";
import { Segmented } from "../ui.tsx";
import type { PrefsApi } from "../usePrefs.ts";

function parseChain(raw: string): Atom[] {
  return raw.split("-").filter((item): item is Atom => (ATOMS as string[]).includes(item));
}

const lookup = (key: string) => lookupTitle(key, locale);
const describe = (chain: Atom[]) => describeChain(chain, locale);

export function KinshipPanel({ api }: { api: PrefsApi }) {
  const self: Gender = api.field("kinship.self", "male") === "female" ? "female" : "male";
  const chain = parseChain(api.field("kinship.chain", "f-m"));
  const setChain = (next: Atom[]) => api.setField("kinship.chain", next.join("-"));
  const forward = chain.length > 0 ? solve(chain, self, lookup, describe) : null;
  const back = chain.length > 0 ? reverseChain(chain, self) : null;
  const backward = back ? solve(back.chain, back.self, lookup, describe) : null;
  const labels = ATOM_LABEL[locale];
  return (
    <div className="fuyu-calc__panel">
      <div className="fuyu-calc__inputs is-center">
        <span className="fuyu-calc__label">{text.kinship.iAm}</span>
        <Segmented<Gender>
          value={self}
          options={[
            { value: "male", label: text.kinship.male },
            { value: "female", label: text.kinship.female },
          ]}
          onChange={(next) => api.update({ fields: { "kinship.self": next, "kinship.chain": "" } })}
        />
      </div>
      <div className="fuyu-calc__chain">{chain.length > 0 ? describe(chain) : <span className="fuyu-calc__muted">{text.kinship.start}</span>}</div>
      <div className="fuyu-calc__keys">
        {ATOMS.map((atom) => (
          <button key={atom} type="button" className="fuyu-calc__key" disabled={!canAppend(chain, atom, self)} onClick={() => setChain([...chain, atom])}>
            {labels[atom]}
          </button>
        ))}
        <button type="button" className="fuyu-calc__key is-quiet" disabled={chain.length === 0} onClick={() => setChain(chain.slice(0, -1))}>
          {text.kinship.back}
        </button>
        <button type="button" className="fuyu-calc__key is-quiet" disabled={chain.length === 0} onClick={() => setChain([])}>
          {text.kinship.clear}
        </button>
      </div>
      {forward && backward && (
        <div className="fuyu-calc__kin-result">
          <div>
            <span className="fuyu-calc__label">{text.kinship.call}</span>
            <strong className="fuyu-calc__kin-title">{forward.titles.join(" / ") || text.kinship.unknown}</strong>
          </div>
          <div>
            <span className="fuyu-calc__label">{text.kinship.theyCall}</span>
            <strong className="fuyu-calc__kin-title">{backward.titles.join(" / ") || text.kinship.unknown}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
