# @fuyu/plugin-review

插件平台第 3 版的逐版审核分析器（任务 E36.5.3）。比较一个插件的两个版本，给出绿 / 黄 / 红三档和每条理由，输出 JSON 和能直接贴进 PR 评论的 Markdown。市场 CI 在每个版本的 PR 上跑它，作者提交前也能在本地跑。分档规则见 `docs/architecture/plugins/v3-phase5-foundation-plan.md` 的 Q1。

```bash
node packages/plugin-review/src/cli.mjs <旧版本源码目录 | -> <新版本源码目录> [--old-built <目录>] [--new-built <目录>] [--json <文件>] [--markdown <文件>] [--format json|markdown]
```

- `-` 表示没有旧版本（首次上架），一律至少黄档。
- 退出码：0 绿档或黄档，1 红档，2 参数或读取出错。
- 代码里用 `review({ oldDir, newDir, oldBuilt, newBuilt })` 拿报告，`renderMarkdown(report)` 出 Markdown。

## 查什么

| 检查 | 怎么看 | 档 |
|---|---|---|
| Node 内置模块 | `import` / `require` / `import()` 的字面量，`node:` 前缀和裸名都算；和旧版比新增的；和清单的 `fuyu.nodeApis` 对照 | 新增的黄 |
| 联网域名 | 字符串里的网址和域名，相邻的字符串拼接（`"a" + "b"`、`["a", "b"].join(".")`）合起来看；和清单的 `fuyu.network` 对照（支持 `*.example.com`） | 新的或没声明的黄 |
| 依赖 | `package.json` 的依赖字段、锁文件（`package-lock.json` v1–v3、`pnpm-lock.yaml` v5–v9）里新增、删除、换版本的包，同一版本内容哈希变了的，新带安装脚本的；有依赖却没有锁文件；安装钩子 | 任何变化都黄 |
| 敏感调用 | `child_process`、`vm`、`eval` / `new Function` / 字符串的 `setTimeout`、`process.binding`、非字面量的 `import()` / `require()`、主目录和系统环境变量里的路径、绝对路径、带 `..` 的路径、浮屿或别的插件的数据目录、运行时拼出来的网址 | 同一文件里比旧版多了就黄 |
| 混淆迹象 | `_0x…` 变量名、`fromCharCode` 拼字符串、密集的 `\x` / `\u` 转义 | 红 |
| | 超长行、大块 base64 / 十六进制、高熵长字符串 | 比旧版多了就黄 |
| 文件 | `.node`、可执行程序和编译过的代码：按扩展名（和 `@fuyu/plugin-manifest` 拒收的一样，含 `.wasm`、`.jar`、`.class`）和文件头（MZ、ELF、Mach-O、WebAssembly、Java class，含 `META-INF/MANIFEST.MF` 或 `.class` 条目的 zip 算 jar） | 红 |
| | 新的或改过的脚本、未知二进制文件，符号链接 | 黄 |
| 清单 | `fuyu.experimental` 不为空 | 红 |
| | `provides` / `replaces` / `network` 变化 | 黄 |
| 改动量 | 文本文件逐行比较（不含锁文件） | 超过 300 行黄 |

只用正则加轻量的词法扫描（去掉注释，识别字符串、模板字符串和正则字面量），不依赖解析器，所以会有漏报和误报：分档只是给维护者的提示，每个版本都要人看过差异后点批准。签名、名字、`engines.fuyu` 这类检查不在这里，归 `@fuyu/plugin-manifest` 和市场 CI。

`test/fixtures/` 是一组模拟的版本：干净的 1.0.0、只改文案的 1.0.1（绿）、靠更新下毒的 1.1.0（加子进程、拼接字符串藏起来的没声明域名）、靠依赖升级下毒的 1.2.0（锁文件里一个依赖换了版本）。
