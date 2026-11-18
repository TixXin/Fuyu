export type SyncEncryptionText = {
  groupTitle: string;
  footnote: string;
  rowTitle: string;
  badges: {
    off: string;
    unlocked: string;
    locked: string;
  };
  keyIdLabel: (keyId: string) => string;
  offDescription: string;
  unlockedDescription: string;
  lockedDescription: string;
  needBackendHint: string;
  openEnableAction: string;
  cancelAction: string;
  warningTitle: string;
  warningBody: string;
  passphraseLabel: string;
  passphrasePlaceholder: string;
  confirmPassphraseLabel: string;
  confirmPassphrasePlaceholder: string;
  passphraseMismatch: string;
  enableSubmitAction: string;
  enablingAction: string;
  enableSuccess: string;
  unlockLabel: string;
  unlockHint: string;
  unlockPlaceholder: string;
  unlockSubmitAction: string;
  unlockingAction: string;
  unlockSuccess: string;
  recoveryTitle: string;
  recoveryDescription: string;
  copyRecoveryAction: string;
  copiedRecoveryNotice: string;
  saveRecoveryAction: string;
  savedRecoveryNotice: (path: string) => string;
  changePassphraseAction: string;
  currentSecretLabel: string;
  currentSecretPlaceholder: string;
  newPassphraseLabel: string;
  newPassphrasePlaceholder: string;
  changePassphraseHint: string;
  changePassphraseSubmit: string;
  changingPassphraseAction: string;
  changedPassphraseNotice: string;
  disableAction: string;
  disableWarning: string;
  disableSubmit: string;
  disablingAction: string;
  disabledNotice: string;
  resetAction: string;
  resetFromLockedAction: string;
  resetWarningTitle: string;
  resetWarningBody: string;
  resetPassphraseLabel: string;
  resetPassphrasePlaceholder: string;
  resetSubmit: string;
  resettingAction: string;
  resetDoneNotice: string;
};

export const zhCN: SyncEncryptionText = {
  groupTitle: "端到端加密",
  footnote:
    "口令经 Argon2id（64 MiB、3 轮）派生密钥封装随机数据密钥，数据用 XChaCha20-Poly1305 加密且绑定远端路径与格式版本；解开的数据密钥仅存本机系统钥匙串，口令本身永不落盘。",
  rowTitle: "端到端加密",
  badges: {
    off: "默认关闭",
    unlocked: "已开启并解锁",
    locked: "待解锁",
  },
  keyIdLabel: (keyId) => `密钥标识：${keyId}`,
  offDescription:
    "默认关闭：开启后远端设备文件均以密文存放，网盘或 WebDAV 服务端无法读取正文；忘了口令且没留恢复密钥时数据无法找回。",
  unlockedDescription:
    "本机已解锁数据密钥，推送与拉取的文件均自动完成端到端加解密。",
  lockedDescription:
    "远端已开启端到端加密，输入同步口令或恢复密钥解锁后即可在这台电脑合并数据。",
  needBackendHint: "先在上方选择同步文件夹或连接 WebDAV，再开启加密",
  openEnableAction: "开启端到端加密…",
  cancelAction: "取消",
  warningTitle: "忘了口令且没有恢复密钥，数据就找不回来",
  warningBody:
    "浮屿和网盘 / WebDAV 服务商都不保存你的口令。开启后请立即导出并妥善保存「恢复密钥」；一旦忘了口令又弄丢恢复密钥，远端加密数据将永远无法找回。",
  passphraseLabel: "加密口令",
  passphrasePlaceholder: "至少 6 个字符，建议用易记长短语",
  confirmPassphraseLabel: "确认加密口令",
  confirmPassphrasePlaceholder: "再次输入相同的加密口令",
  passphraseMismatch: "两次输入的加密口令不一致。",
  enableSubmitAction: "确认开启并加密远端",
  enablingAction: "正在加密迁移…",
  enableSuccess: "已开启端到端加密并完成远端迁移；建议现在复制或保存一份恢复密钥。",
  unlockLabel: "同步口令或恢复密钥",
  unlockHint: "输入设置加密时填的口令，或以 FUYU- 开头的恢复密钥",
  unlockPlaceholder: "输入口令或 FUYU-XXXXXXX-…",
  unlockSubmitAction: "解锁并同步",
  unlockingAction: "正在解锁…",
  unlockSuccess: "已解锁端到端加密并完成同步。",
  recoveryTitle: "恢复密钥",
  recoveryDescription:
    "忘了口令或在新电脑解锁时可用；密钥不在页面显示，直接隐藏写入剪贴板或保存到「下载」文件夹。",
  copyRecoveryAction: "复制恢复密钥",
  copiedRecoveryNotice: "已复制恢复密钥到剪贴板（不记入剪贴板历史），请粘贴到密码管理器妥善保管。",
  saveRecoveryAction: "保存恢复密钥文件",
  savedRecoveryNotice: (path) => `已保存恢复密钥到：${path}`,
  changePassphraseAction: "修改口令…",
  currentSecretLabel: "当前口令或恢复密钥",
  currentSecretPlaceholder: "输入当前口令或 FUYU- 恢复密钥",
  newPassphraseLabel: "新加密口令",
  newPassphrasePlaceholder: "至少 6 个字符",
  changePassphraseHint: "修改口令只会重新封装 meta.json 里的数据密钥，无需重写全部远端数据文件。",
  changePassphraseSubmit: "保存新口令",
  changingPassphraseAction: "正在更新口令…",
  changedPassphraseNotice: "已更新加密口令，其他已解锁的电脑无需重新输入。",
  disableAction: "关闭加密…",
  disableWarning:
    "关闭端到端加密会把远端所有设备文件整体解密迁回明文 JSON，不会丢失数据，但此后网盘或 WebDAV 服务端将可直接看到文件内容。",
  disableSubmit: "确认关闭并迁回明文",
  disablingAction: "正在解密迁移…",
  disabledNotice: "已关闭端到端加密，远端文件已完整迁回明文。",
  resetAction: "重置远端…",
  resetFromLockedAction: "忘了口令？用本机数据重置远端…",
  resetWarningTitle: "确认用这台电脑的数据重置远端？",
  resetWarningBody:
    "这会清空远端目录中现有的同步文件，并用这台电脑当前保留的数据重新上传。其他电脑上尚未同步到本机的改动不会包含在内。",
  resetPassphraseLabel: "重置后的新加密口令（留空则不加密）",
  resetPassphrasePlaceholder: "留空恢复明文，或填写至少 6 位新口令",
  resetSubmit: "确认清空并重新上传",
  resettingAction: "正在重置远端…",
  resetDoneNotice: "已清空远端并用本机数据重新上传。",
};

export const en: SyncEncryptionText = {
  groupTitle: "End-to-end encryption",
  footnote:
    "Your passphrase derives a wrapping key via Argon2id (64 MiB, 3 rounds) to protect a random data key; device files use XChaCha20-Poly1305 bound to remote path and schema version, while the unlocked data key stays in your OS keychain.",
  rowTitle: "End-to-end encryption",
  badges: {
    off: "Off by default",
    unlocked: "Encrypted & unlocked",
    locked: "Locked",
  },
  keyIdLabel: (keyId) => `Key ID: ${keyId}`,
  offDescription:
    "Off by default: encrypts remote device files so your cloud drive or WebDAV provider cannot read them. If you forget the passphrase without a recovery key, remote data cannot be recovered.",
  unlockedDescription:
    "The data key is unlocked on this computer; pushed and pulled sync files are encrypted and decrypted automatically.",
  lockedDescription:
    "Remote sync is encrypted. Enter your passphrase or recovery key to unlock and merge on this computer.",
  needBackendHint: "Choose a sync folder or connect WebDAV above first",
  openEnableAction: "Enable encryption…",
  cancelAction: "Cancel",
  warningTitle: "If you forget the passphrase without a recovery key, data cannot be recovered",
  warningBody:
    "Neither Fuyu nor your cloud or WebDAV provider stores your passphrase. Export and keep your recovery key right after enabling — if both are lost, encrypted remote data is permanently unrecoverable.",
  passphraseLabel: "Encryption passphrase",
  passphrasePlaceholder: "At least 6 characters",
  confirmPassphraseLabel: "Confirm passphrase",
  confirmPassphrasePlaceholder: "Re-enter the same passphrase",
  passphraseMismatch: "The two passphrases do not match.",
  enableSubmitAction: "Enable & encrypt remote",
  enablingAction: "Encrypting remote…",
  enableSuccess: "End-to-end encryption is on and remote files were migrated. Save a copy of your recovery key now.",
  unlockLabel: "Passphrase or recovery key",
  unlockHint: "Enter your sync passphrase or a FUYU- recovery key",
  unlockPlaceholder: "Enter passphrase or FUYU-XXXXXXX-…",
  unlockSubmitAction: "Unlock & sync",
  unlockingAction: "Unlocking…",
  unlockSuccess: "Unlocked end-to-end encryption and finished syncing.",
  recoveryTitle: "Recovery key",
  recoveryDescription:
    "Use this to unlock a new computer or recover if you forget your passphrase. Copied concealed to clipboard or saved to Downloads without exposing plaintext to page scripts.",
  copyRecoveryAction: "Copy recovery key",
  copiedRecoveryNotice: "Copied recovery key to clipboard (excluded from clipboard history). Store it in your password manager.",
  saveRecoveryAction: "Save recovery key file",
  savedRecoveryNotice: (path) => `Saved recovery key to: ${path}`,
  changePassphraseAction: "Change passphrase…",
  currentSecretLabel: "Current passphrase or recovery key",
  currentSecretPlaceholder: "Enter current passphrase or FUYU- key",
  newPassphraseLabel: "New passphrase",
  newPassphrasePlaceholder: "At least 6 characters",
  changePassphraseHint: "Changing the passphrase only re-wraps the data key in meta.json without rewriting device files.",
  changePassphraseSubmit: "Save new passphrase",
  changingPassphraseAction: "Updating passphrase…",
  changedPassphraseNotice: "Updated the sync passphrase; already-unlocked computers stay unlocked.",
  disableAction: "Turn off encryption…",
  disableWarning:
    "Turning off end-to-end encryption migrates all remote device files back to cleartext JSON without losing data, allowing your storage provider to read file contents again.",
  disableSubmit: "Turn off & migrate to cleartext",
  disablingAction: "Decrypting remote…",
  disabledNotice: "Turned off end-to-end encryption and migrated remote files back to cleartext.",
  resetAction: "Reset remote…",
  resetFromLockedAction: "Forgot passphrase? Reset remote from this computer…",
  resetWarningTitle: "Reset remote store using this computer's local data?",
  resetWarningBody:
    "This deletes existing remote sync files and re-uploads the items currently on this computer. Unsynced changes from other computers will not be included.",
  resetPassphraseLabel: "New passphrase after reset (leave blank for cleartext)",
  resetPassphrasePlaceholder: "Leave blank for cleartext, or at least 6 characters",
  resetSubmit: "Clear remote & re-upload",
  resettingAction: "Resetting remote…",
  resetDoneNotice: "Cleared the remote store and re-uploaded local data from this computer.",
};
