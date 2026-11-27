export type SettingsNetworkProxyText = {
  title: string;
  modeLabel: string;
  modeSystem: string;
  modeManual: string;
  modeDirect: string;
  systemDetectedPrefix: string;
  systemNone: string;
  systemPacPrefix: string;
  systemWpad: string;
  systemAutoVia: string;
  systemAutoDirect: string;
  directHint: string;
  serverLabel: string;
  serverDescription: string;
  schemeAriaLabel: string;
  schemeHttp: string;
  schemeSocks5: string;
  hostPlaceholder: string;
  portPlaceholder: string;
  hostAriaLabel: string;
  portAriaLabel: string;
  advancedLabel: string;
  authLabel: string;
  authDescription: string;
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  passwordSavedPlaceholder: string;
  clearPassword: string;
  passwordWillClear: string;
  bypassLabel: string;
  bypassDescription: string;
  bypassPlaceholder: string;
  save: string;
  saving: string;
  saved: string;
  test: string;
  testing: string;
  testOk: (latencyMs: number, via: string | null) => string;
  footnote: string;
};

export const zhCN: SettingsNetworkProxyText = {
  title: "网络代理",
  modeLabel: "代理模式",
  modeSystem: "跟随系统",
  modeManual: "手动代理",
  modeDirect: "不使用代理",
  systemDetectedPrefix: "已检测到系统代理",
  systemNone: "当前未检测到系统代理，将直接连接网络",
  systemPacPrefix: "已检测到自动配置脚本（PAC）",
  systemWpad: "系统开启了自动检测代理（WPAD）",
  systemAutoVia: "访问外网时走",
  systemAutoDirect: "访问外网时直接连接；邮箱等按目标地址逐个判断",
  directHint: "忽略系统和环境变量中的代理，直接连接网络",
  serverLabel: "代理地址",
  serverDescription: "选择协议并填写主机和端口（支持直接粘贴代理链接）",
  schemeAriaLabel: "代理协议",
  schemeHttp: "HTTP",
  schemeSocks5: "SOCKS5",
  hostPlaceholder: "proxy.company.com 或 127.0.0.1",
  portPlaceholder: "端口",
  hostAriaLabel: "代理主机地址",
  portAriaLabel: "代理端口",
  advancedLabel: "身份验证与免代理",
  authLabel: "身份验证",
  authDescription: "如代理需要账号密码再填写，密码存放在系统凭据库中",
  usernamePlaceholder: "用户名",
  passwordPlaceholder: "密码",
  passwordSavedPlaceholder: "已保存，留空保持不变",
  clearPassword: "清除密码",
  passwordWillClear: "保存后将清除已保存的密码",
  bypassLabel: "免代理地址",
  bypassDescription: "逗号分隔，支持 *.company.local 等通配符；本机地址默认直连",
  bypassPlaceholder: "*.corp.local, 10.*, intranet.local",
  save: "保存并应用",
  saving: "保存中…",
  saved: "已保存并立即生效",
  test: "测试连接",
  testing: "测试中…",
  testOk: (latencyMs, via) => (via ? `已连通 · ${latencyMs} ms · 经 ${via}` : `已连通 · ${latencyMs} ms · 直连`),
  footnote: "适用于插件市场、插件联网、邮箱、日历、应用更新、主题市场、同步与翻译。部分公司 HTTP 代理会限制邮箱端口（993/465/587）的 CONNECT 隧道，如遇受限可改用 SOCKS5。",
};

export const en: SettingsNetworkProxyText = {
  title: "Network proxy",
  modeLabel: "Proxy mode",
  modeSystem: "Follow system",
  modeManual: "Manual",
  modeDirect: "Direct",
  systemDetectedPrefix: "Detected system proxy",
  systemNone: "No system proxy detected; connecting directly",
  systemPacPrefix: "Detected auto-config script (PAC)",
  systemWpad: "Automatic proxy detection (WPAD) is on",
  systemAutoVia: "Internet traffic goes through",
  systemAutoDirect: "Internet traffic connects directly; mail and other servers are checked one by one",
  directHint: "Ignore system and environment proxy settings and connect directly",
  serverLabel: "Proxy server",
  serverDescription: "Choose a protocol and enter the host and port (pasting a full URL also works)",
  schemeAriaLabel: "Proxy protocol",
  schemeHttp: "HTTP",
  schemeSocks5: "SOCKS5",
  hostPlaceholder: "proxy.company.com or 127.0.0.1",
  portPlaceholder: "Port",
  hostAriaLabel: "Proxy server host",
  portAriaLabel: "Proxy server port",
  advancedLabel: "Authentication & bypass",
  authLabel: "Authentication",
  authDescription: "Only needed if your proxy requires sign-in; passwords are kept in the system keyring",
  usernamePlaceholder: "Username",
  passwordPlaceholder: "Password",
  passwordSavedPlaceholder: "Saved; leave blank to keep",
  clearPassword: "Clear password",
  passwordWillClear: "Saved password will be removed on save",
  bypassLabel: "Bypass proxy for",
  bypassDescription: "Comma-separated hosts or wildcards such as *.company.local; loopback always connects directly",
  bypassPlaceholder: "*.corp.local, 10.*, intranet.local",
  save: "Save & apply",
  saving: "Saving…",
  saved: "Saved and applied",
  test: "Test connection",
  testing: "Testing…",
  testOk: (latencyMs, via) => (via ? `Connected · ${latencyMs} ms · via ${via}` : `Connected · ${latencyMs} ms · direct`),
  footnote: "Applies to the plugin market, plugin HTTP requests, mail, calendar, updates, theme market, sync and translation. Some corporate HTTP proxies block CONNECT tunnels to mail ports (993/465/587); use SOCKS5 if blocked.",
};
