import { addSettingsCategory } from "../../plugin-kernel/settingsCategories";
import { SshTunnelSettings } from "../SshTunnelSettings";
import { OWNER } from "./owner.ts";

addSettingsCategory("agentTunnel", () => <SshTunnelSettings />, OWNER);
