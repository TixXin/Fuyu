import assert from "node:assert/strict";
import test from "node:test";
import { htmlToPlainText, mailCopyableText, notificationCopyableText } from "../../src/features/messages/messageCopy.ts";

test("htmlToPlainText strips tags, styles and scripts while keeping paragraph and table structure", () => {
  const html = "<style>body{color:red}</style><h2>订单确认</h2><p>您的订单号：<strong>SF123456789</strong><br>收货地址：北京市海淀区中关村 1 号</p><table><tr><th>商品</th><th>数量</th></tr><tr><td>键盘</td><td>1</td></tr></table><script>alert(1)</script>";
  assert.equal(
    htmlToPlainText(html),
    "订单确认\n您的订单号：SF123456789\n收货地址：北京市海淀区中关村 1 号\n商品\t数量\n键盘\t1",
  );
  assert.equal(htmlToPlainText("<p>A&nbsp;&amp;&nbsp;B &#x3C;ok&#62;</p>"), "A & B <ok>");
});

test("mailCopyableText prefers readable body and falls back to subject", () => {
  assert.equal(mailCopyableText("验证码 884210", null), "验证码 884210");
  assert.equal(mailCopyableText("验证码 884210", { content: "   ", contentType: "text/plain" }), "验证码 884210");
  assert.equal(mailCopyableText("周报", { content: "  第一行\r\n第二行  ", contentType: "text/plain" }), "第一行\n第二行");
  assert.equal(mailCopyableText("周报", { content: "<p>HTML 正文</p>", contentType: "text/html" }), "HTML 正文");
});

test("notificationCopyableText returns message body when present or title otherwise", () => {
  assert.equal(notificationCopyableText("设计讨论组", "  验证码 654321，5 分钟内有效  "), "验证码 654321，5 分钟内有效");
  assert.equal(notificationCopyableText("  [GitHub] Please verify your device  ", "   "), "[GitHub] Please verify your device");
});
