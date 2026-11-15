# 钉钉 CalDAV

> 日期：2026-11-15。问题：用户群反馈「添加钉钉 webdav 日历返回 405」，钉钉的 CalDAV 服务器地址怎么填、支持哪些请求。范围：网页搜索「钉钉 CalDAV 服务器地址」「calendar.dingtalk.com/dav」，KDE / Mozilla 社区帖子；不登录直接用 curl 探测 `calendar.dingtalk.com` 各路径的响应头。相关任务：D59（#369）。

## 结论

- 钉钉没有公开的 CalDAV 文档（没搜到官方帮助页，未核实）。客户端里的入口是「日历 → 设置 → CalDAV 同步」，打开后给出一组专用的账号和密码（岛屿设置页的说明就是照这个写的），服务器是 `calendar.dingtalk.com`。
- **服务器根路径不是 CalDAV。** `https://calendar.dingtalk.com/` 是一个 Spring 应用，`OPTIONS` 回 `Allow: GET,HEAD`，`PROPFIND` 回 405（`HttpRequestMethodNotSupportedException`）。这就是用户看到的 405：岛屿原来直接对预填的服务器地址发 `PROPFIND`。
- CalDAV 服务在 `/dav/` 下，Basic 认证（`WWW-Authenticate: Basic realm="Cosmo"`，看起来是 Cosmo 系的 CalDAV 服务器）。`/.well-known/caldav` 对任何方法都 302 到 `https://calendar.dingtalk.com/dav/principals/`，按 RFC 6764 做服务发现的客户端（iOS、DAVx⁵、Thunderbird）因此只填主机名就能用。
- 岛屿的修法：对填的地址 PROPFIND 失败（非 401/403）或找不到日历线索时，改试 `/.well-known/caldav`；重定向自己跟（reqwest 跟 302 会把 PROPFIND 改成 GET），只跟同一主机的 https，最多 5 次。之后照旧 `current-user-principal` → `calendar-home-set` → 日历。
- 没有钉钉账号，登录之后 `/dav/principals/` 返回什么、principal 和日历主目录的路径长什么样，都没有实测（未核实），单元测试用的是假设的路径。

## 详细

不带账号的探测结果（2026-11-15）：

| 请求 | 结果 |
|---|---|
| `OPTIONS /` | 200，`Allow: GET,HEAD` |
| `PROPFIND /` | 405，Spring 的 JSON 错误 |
| `PROPFIND /caldav/` | 405 |
| `OPTIONS` / `PROPFIND` / `GET /.well-known/caldav` | 302 → `/dav/principals/` |
| `OPTIONS` / `PROPFIND /dav/`、`/dav/principals/` | 401，`Basic realm="Cosmo"` |

社区里有人用 Thunderbird、DAVx⁵ 接钉钉的 CalDAV 能读到日程，KOrganizer 有同步问题；这些帖子都只写了主机名 `calendar.dingtalk.com`，没写完整路径。

## 来源

- KDE Bug 447683（服务器 calendar.dingtalk.com，Thunderbird 和 DAVx⁵ 能用）：https://bugs.kde.org/show_bug.cgi?id=447683
- Mozilla 社区，Thunderbird 添加钉钉 CalDAV 日历：https://connect.mozilla.org/t5/discussions/i-m-using-thunderbird-and-have-added-a-caldav-calendar-account/td-p/112279
- RFC 6764（CalDAV 的 `/.well-known/caldav` 服务发现）：https://www.rfc-editor.org/rfc/rfc6764
