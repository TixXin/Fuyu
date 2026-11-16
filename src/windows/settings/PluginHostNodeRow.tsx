import { useTranslation } from "../../i18n";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { usePluginHostNode } from "./usePluginHostNode";

function megabytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function PluginHostNodeRow({ watching }: { watching: boolean }) {
  const text = useTranslation().settings.pluginsV3.node;
  const { node, retry } = usePluginHostNode(watching);
  if (node?.state === "downloading") {
    const progress = node.total ? text.progress(megabytes(node.downloaded), megabytes(node.total)) : text.progressUnknown(megabytes(node.downloaded));
    return (
      <SettingsRow
        searchable={false}
        className="plugins-v3__node"
        title={<span className="plugins-v3__connection plugins-v3__connection--connecting" data-node="downloading">{text.downloading}</span>}
        description={text.downloadingNote}
        control={<span className="plugins-v3__value">{progress}</span>}
      />
    );
  }
  if (node?.state === "failed") {
    return (
      <SettingsRow
        searchable={false}
        className="plugins-v3__node"
        title={<span className="plugins-v3__connection plugins-v3__connection--failed" data-node="failed">{text.failed}</span>}
        description={<><span className="plugins-v3__node-error">{node.error}</span> {text.failedNote}</>}
        control={<button className="plugins-v3__leave plugins-v3__retry" type="button" onClick={retry}>{text.retry}</button>}
      />
    );
  }
  return null;
}
