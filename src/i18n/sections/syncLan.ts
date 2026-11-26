export type SyncLanText = {
  intro: string;
  enable: string;
  thisDevice: string;
  thisDeviceHint: (id: string, port: number) => string;
  notAnnounced: string;
  showCode: string;
  codeTitle: string;
  codeHint: (seconds: number) => string;
  cancelCode: string;
  joinTitle: string;
  joinHint: string;
  addressLabel: string;
  addressPlaceholder: string;
  codeLabel: string;
  codePlaceholder: string;
  join: string;
  joining: string;
  nearbyTitle: string;
  nearbyUse: string;
  peersTitle: string;
  peersEmpty: string;
  peerHint: (id: string, address: string | null) => string;
  remove: string;
  removeConfirm: string;
  clipTitle: string;
  clipHint: string;
  windowsHint: string;
  macHint: string;
};

export const zhCN: SyncLanText = {
  intro: "同一个网络里的两台电脑直接互传，不经过网盘或服务器，链路全程加密。",
  enable: "启用局域网直连",
  thisDevice: "本机",
  thisDeviceHint: (id, port) => `识别码 ${id} · 端口 ${port}`,
  notAnnounced: "没能在局域网里广播本机，对方要手动填本机的地址。",
  showCode: "显示配对码",
  codeTitle: "配对码",
  codeHint: (seconds) => `在另一台电脑上输入，${seconds} 秒内有效`,
  cancelCode: "取消",
  joinTitle: "输入另一台的配对码",
  joinHint: "在另一台电脑上点「显示配对码」，再在这里填它的地址和配对码",
  addressLabel: "对方地址",
  addressPlaceholder: "例如 192.168.1.20",
  codeLabel: "配对码",
  codePlaceholder: "6 位数字",
  join: "配对",
  joining: "正在配对…",
  nearbyTitle: "附近的浮屿",
  nearbyUse: "填入地址",
  peersTitle: "已配对的电脑",
  peersEmpty: "还没有配对的电脑",
  peerHint: (id, address) => (address ? `识别码 ${id} · ${address}` : `识别码 ${id} · 还没找到`),
  remove: "移除",
  removeConfirm: "确认移除",
  clipTitle: "剪贴板互传",
  clipHint: "复制的文字自动发到已配对的电脑，进对方的剪贴板历史。只发文字，密码、隐私和敏感内容不发；两台都要打开",
  windowsHint: "Windows 第一次打开时会弹出防火墙提示，请点「允许」并勾选专用网络。连不上时看看网络是不是被设成了「公用」，或路由器开了 AP 隔离。",
  macHint: "Mac 第一次连接时会问是否允许浮屿访问本地网络，请点「允许」；拒绝过的话到「系统设置 → 隐私与安全性 → 本地网络」里打开。",
};

export const en: SyncLanText = {
  intro: "Two computers on the same network sync directly, with no cloud drive or server in between. The link is encrypted end to end.",
  enable: "Use the local network link",
  thisDevice: "This computer",
  thisDeviceHint: (id, port) => `ID ${id} · port ${port}`,
  notAnnounced: "Could not announce this computer on the network; type its address on the other one.",
  showCode: "Show pairing code",
  codeTitle: "Pairing code",
  codeHint: (seconds) => `Type it on the other computer within ${seconds} s`,
  cancelCode: "Cancel",
  joinTitle: "Enter the other computer's code",
  joinHint: "Click Show pairing code on the other computer, then enter its address and code here",
  addressLabel: "Address",
  addressPlaceholder: "e.g. 192.168.1.20",
  codeLabel: "Code",
  codePlaceholder: "6 digits",
  join: "Pair",
  joining: "Pairing…",
  nearbyTitle: "Fuyu nearby",
  nearbyUse: "Use address",
  peersTitle: "Paired computers",
  peersEmpty: "No paired computers yet",
  peerHint: (id, address) => (address ? `ID ${id} · ${address}` : `ID ${id} · not found yet`),
  remove: "Remove",
  removeConfirm: "Confirm",
  clipTitle: "Share clipboard",
  clipHint: "Text you copy goes to the paired computers' clipboard history. Text only; passwords, private and sensitive items are never sent. Turn it on on both",
  windowsHint: "The first time, Windows asks about the firewall: click Allow and tick Private networks. If the other computer cannot connect, check that the network is not set to Public and that the router has no AP isolation.",
  macHint: "The first time, the Mac asks whether Fuyu may access the local network: click Allow. If you said no, turn it on in System Settings → Privacy & Security → Local Network.",
};
