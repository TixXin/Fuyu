import { settingsSections } from "../../plugin-kernel/settingsSlots";
import { SshTunnelSettings } from "../SshTunnelSettings";
import { OWNER } from "./owner.ts";

settingsSections().add({ id: "agentRemote.ssh-tunnel", category: "agentRemote", order: 20, component: SshTunnelSettings }, OWNER);
