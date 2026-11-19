import { useEffect, useState } from "react";
import { isPinyinLoaded, loadedPinyin, loadPinyin, type PinyinOf } from "./pinyin";

export function usePinyin(wanted: boolean): PinyinOf | null {
  const [ready, setReady] = useState(isPinyinLoaded);
  useEffect(() => {
    if (!wanted || ready) return;
    let cancelled = false;
    void loadPinyin().then((pinyin) => {
      if (!cancelled && pinyin) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [wanted, ready]);
  return ready ? loadedPinyin() : null;
}
