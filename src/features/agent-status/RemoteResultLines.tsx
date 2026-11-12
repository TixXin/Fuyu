import { useTranslation } from "../../i18n";
import type { RemoteResult } from "./api";

export function RemoteResultLines({ results }: { results: RemoteResult[] | undefined }) {
  const text = useTranslation().settings.agent;
  return <>{results?.map(({ host, error }) => <span key={host}><br />{text.remoteResult(host, error)}</span>)}</>;
}
