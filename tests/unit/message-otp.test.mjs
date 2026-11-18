import assert from "node:assert/strict";
import test from "node:test";
import { extractVerificationCode, hasVerificationClue, otpActionId, parseOtpAction } from "../../src/features/messages/otp.ts";

test("extracts Chinese and English verification codes from subjects and bodies", () => {
  assert.equal(
    extractVerificationCode("【自如网】自如验证码 356407，有效时间为 5 分钟，客服电话 4001001111"),
    "356407",
  );
  assert.equal(
    extractVerificationCode("[GitHub] Please verify your device", "Verification code: 849201\nIf you did not request this in 2026, ignore this email."),
    "849201",
  );
  assert.equal(
    extractVerificationCode("Microsoft account security code", "Use 12345X as your Microsoft account security code."),
    "12345X",
  );
  assert.equal(
    extractVerificationCode("Google Verification", "G-604912 is your Google verification code."),
    "604912",
  );
  assert.equal(
    extractVerificationCode("Sign-in code", "Your one-time code is 482-910."),
    "482910",
  );
});

test("cleans HTML emails and ignores attributes, URLs, account IDs, phone numbers, dates and prices", () => {
  const html = `
    <style>.code { color: #336699; width: 600px; }</style>
    <table width="640">
      <tr><td>尊敬的用户（账号 ID：100022305033，手机 13812345678）：</td></tr>
      <tr><td>您的登录验证码为 <strong>739204</strong>，请在 10 分钟内输入。</td></tr>
      <tr><td>订单金额 ¥1288.00，日期 2026-11-17 14:30，详情见 <a href="https://example.com/auth?token=99887766">链接</a></td></tr>
    </table>
  `;
  assert.equal(extractVerificationCode("登录验证", html, "text/html"), "739204");
});

test("never false-positives on ordinary notifications with years, order numbers, ports or error codes", () => {
  assert.equal(
    extractVerificationCode("【腾讯云】域名续费提醒", "您的账号 ID：100022305033 下有域名将于 2026-11-30 到期，请访问 https://mc.tencent.com/883920 续费。"),
    null,
  );
  assert.equal(extractVerificationCode("项目周报 2026", "本周合并了 PR 1420，本地开发端口 5199，HTTP status code 500 已修复。"), null);
  assert.equal(extractVerificationCode("顺丰速运", "您的快件单号 77301928371，预计 18:30 送达，优惠码 SAVE2026。"), null);
  assert.equal(extractVerificationCode("设计讨论组", "新版界面已准备好，方便时看一下 2026 版的图标。"), null);
});

test("hasVerificationClue spots verification subjects without flagging regular newsletters", () => {
  assert.equal(hasVerificationClue("[GitHub] Please verify your device"), true);
  assert.equal(hasVerificationClue("安全登录确认"), true);
  assert.equal(hasVerificationClue("项目周报与下周安排"), false);
  assert.equal(parseOtpAction(otpActionId("356407")), "356407");
  assert.equal(parseOtpAction("open"), null);
});
