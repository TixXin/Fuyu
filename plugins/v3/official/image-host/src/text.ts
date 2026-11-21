import { currentLocale, type Locale } from "./locale.ts";
import type { ErrorInfo } from "./model.ts";

const en = {
  actionLabel: "Upload",
  ready: "Ready. Screenshot cards now have an Upload button.",
  missing: "Still needed:",
  missingEndpoint: "the endpoint",
  missingBucket: "the bucket",
  missingKeys: "the access keys",
  setupHint: "Fill in your storage",
  storageTitle: "Storage",
  storageHint: "Any S3-compatible storage: Cloudflare R2, Amazon S3, Alibaba Cloud OSS, Tencent Cloud COS, or MinIO on this computer.",
  endpoint: "Endpoint",
  endpointHint: "The S3 API address from your provider, starting with https://. MinIO on this computer can use http://localhost:9000.",
  endpointBad: "Use an https:// address, or http://localhost for MinIO.",
  region: "Region",
  regionHint: "auto for R2. For the others, the region your bucket is in.",
  bucket: "Bucket",
  bucketBad: "3–63 lowercase letters, digits, dots or dashes.",
  pathStyle: "Put the bucket in the path instead of the host name",
  pathStyleHint: "Turn this on if your provider asks for path-style addresses. MinIO on this computer always uses it.",
  keysTitle: "Access keys",
  keysHint: "Kept in Windows Credential Manager or the macOS Keychain, never in a file. This page only shows whether they are saved.",
  accessKeyId: "Access key ID",
  secretAccessKey: "Secret access key",
  saved: "Saved",
  notSaved: "Not saved",
  keyPlaceholderSaved: "Saved. Paste a new one to replace it.",
  keyPlaceholder: "Paste it here. It is saved when you leave the box.",
  clearKeys: "Forget keys",
  linkTitle: "Link",
  prefix: "Folder in the bucket",
  prefixHint: (example: string) => `Screenshots go to ${example}`,
  publicBase: "Public address",
  publicBaseHint: "The address people open, such as your own domain or R2's public bucket address. Leave it empty to use the endpoint address, which only works if the bucket is public.",
  publicBaseBad: "Use an address that starts with https://.",
  copyAs: "Copy",
  copyUrl: "Link",
  copyMarkdown: "Markdown",
  testTitle: "Try it",
  test: "Upload a test picture",
  testing: "Uploading…",
  testHint: "Uploads a tiny picture, always to the same name, so trying again does not pile up files.",
  lastUpload: (clock: string) => `Last upload at ${clock}`,
  lastTest: (clock: string) => `Test upload at ${clock}`,
  copied: "Uploaded. Link copied.",
  uploaded: "Uploaded.",
  notReady: "Set up the image host first. Opening the settings.",
  failedAuth: "Upload refused: check the keys, the region and the bucket's permissions.",
  failedBucket: "Bucket not found: check the bucket name and the endpoint.",
  failedBlocked: "This plugin can't connect to that endpoint. It works with R2, S3, OSS, COS and MinIO on this computer.",
  failedTimeout: "Upload timed out. Try again.",
  failedNetwork: "Can't reach the endpoint. Check the address and your network.",
  failedFile: "Can't read the screenshot file.",
  failedSecrets: "Can't reach the system credential store.",
  failedServer: (status: number, code: string | null) => `Upload failed (HTTP ${status}${code ? `, ${code}` : ""}).`,
};

const zhCN: typeof en = {
  actionLabel: "上传图床",
  ready: "设好了。截图卡片上会出现「上传图床」。",
  missing: "还差：",
  missingEndpoint: "服务地址",
  missingBucket: "桶",
  missingKeys: "密钥",
  setupHint: "填好图床",
  storageTitle: "存储",
  storageHint: "支持 S3 兼容的存储：Cloudflare R2、Amazon S3、阿里云 OSS、腾讯云 COS，或本机的 MinIO。",
  endpoint: "服务地址",
  endpointHint: "服务商给的 S3 接口地址，https:// 开头；本机的 MinIO 可以用 http://localhost:9000。",
  endpointBad: "要用 https:// 开头的地址；本机的 MinIO 可以用 http://localhost。",
  region: "区域",
  regionHint: "R2 填 auto，其他填桶所在的区域。",
  bucket: "桶",
  bucketBad: "3–63 个小写字母、数字、点或短横线。",
  pathStyle: "桶名放在路径里，不放在域名里",
  pathStyleHint: "服务商要求路径式地址时打开。本机的 MinIO 总是用路径式。",
  keysTitle: "密钥",
  keysHint: "存在 Windows 凭据管理器或 macOS 钥匙串里，不写进文件。这里只显示存没存。",
  accessKeyId: "Access Key ID",
  secretAccessKey: "Secret Access Key",
  saved: "已保存",
  notSaved: "未保存",
  keyPlaceholderSaved: "已保存，粘贴新的会替换",
  keyPlaceholder: "粘贴到这里，离开输入框就保存",
  clearKeys: "删除密钥",
  linkTitle: "链接",
  prefix: "桶里的文件夹",
  prefixHint: (example: string) => `截图存到 ${example}`,
  publicBase: "公开访问地址",
  publicBaseHint: "别人打开链接用的地址，比如你自己的域名或 R2 的公开访问地址。留空时用服务地址，只有桶是公开的才打得开。",
  publicBaseBad: "要用 https:// 开头的地址。",
  copyAs: "复制",
  copyUrl: "链接",
  copyMarkdown: "Markdown",
  testTitle: "试一下",
  test: "上传一张测试图",
  testing: "上传中…",
  testHint: "传一张很小的图，每次都用同一个名字，多试几次也不会堆文件。",
  lastUpload: (clock: string) => `上次上传：${clock}`,
  lastTest: (clock: string) => `测试上传：${clock}`,
  copied: "已上传，链接已复制",
  uploaded: "已上传",
  notReady: "还没设好图床，已打开设置",
  failedAuth: "上传被拒绝：检查密钥、区域和桶的权限。",
  failedBucket: "找不到这个桶：检查桶名和服务地址。",
  failedBlocked: "插件连不了这个服务地址。支持 R2、S3、OSS、COS 和本机的 MinIO。",
  failedTimeout: "上传超时，再试一次。",
  failedNetwork: "连不上服务地址，检查地址和网络。",
  failedFile: "读不到截图文件。",
  failedSecrets: "读写不了系统凭据。",
  failedServer: (status: number, code: string | null) => `上传失败（HTTP ${status}${code ? `，${code}` : ""}）。`,
};

export type HostText = typeof en;

export const textFor = (locale: Locale): HostText => (locale === "zh-CN" ? zhCN : en);

export const text = textFor(currentLocale());

export function failureText(error: ErrorInfo, text: HostText): string {
  switch (error.reason) {
    case "auth":
      return text.failedAuth;
    case "bucket":
      return text.failedBucket;
    case "blocked":
      return text.failedBlocked;
    case "timeout":
      return text.failedTimeout;
    case "file":
      return text.failedFile;
    case "secrets":
      return text.failedSecrets;
    case "setup":
      return text.notReady;
    case "server":
      return text.failedServer(error.status, error.code);
    default:
      return text.failedNetwork;
  }
}
