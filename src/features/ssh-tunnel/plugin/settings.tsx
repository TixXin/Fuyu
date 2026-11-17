import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { SshTunnelSettings } from "../SshTunnelSettings";
import { OWNER } from "./owner.ts";

const sections = settingsSections<object, "agentRemote">();

sections.add({ id: "agentRemote.sshTunnel", category: "agentRemote", order: 20, component: SshTunnelSettings }, OWNER);
