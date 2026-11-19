# 离线词典 · Offline dictionary

`@fuyu/ecdict` · 浮屿官方插件 · Windows / macOS

给浮屿的快捷翻译加一个离线英汉词典：不用填任何 API Key，不联网，查词几乎是瞬间出结果。词库来自开源的 ECDICT。

## 装好后在哪里

- **设置 → 翻译 → 翻译服务**：下拉框里多出「离线词典」，选它就行。

这个插件不在岛上加页面，查词照常用浮屿的快捷翻译窗口。

## 怎么用

1. 打开「设置 → 翻译」，在「翻译服务」里选「离线词典」。
2. 用快捷翻译查英文单词或短语，会显示原形、音标和多条中文释义。
   - 不分大小写，自动去掉首尾标点。
   - 变形词会还原成原形再查，比如 `studies`、`running`、`went`、`better`。
3. 输入简短的中文词组，会反查对应的英文词条。
4. 整句或整段超出词典的范围，会提示你换用在线翻译服务。

词典收录约 1.17 万条常用词、常用短语和软件开发术语，适合查单词，不能翻译句子。

这个插件没有设置项。

## 它会用到什么

- 只读插件自带的词表文件。
- 不联网，不需要账号或密钥，查过的词不会发到任何地方。

## 数据来源与许可

插件代码以 MIT 许可发布。词表 `assets/ecdict.json` 取自开源项目 [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)（提交 `39cfb9672c0906b63569e0453c2e6abfb9ab182a`，`Copyright (c) 2025 Linwei`，MIT 许可），完整的版权和许可声明见同目录的 `LICENSE`。

---

## English

`@fuyu/ecdict` · Official Fuyu plugin · Windows / macOS

Adds an offline English–Chinese dictionary to Fuyu's quick translation: no API key, no network, and results appear almost instantly. The word list comes from the open-source ECDICT.

### Where it shows up

- **Settings → Translation → Translation service**: "Offline dictionary" appears in the list; just pick it.

It adds no page to the island; look words up in Fuyu's quick translation window as usual.

### How to use it

1. Open Settings → Translation and choose "Offline dictionary" under "Translation service".
2. Look up an English word or phrase in quick translation to see its base form, phonetics and Chinese meanings.
   - Case doesn't matter, and punctuation around the word is ignored.
   - Inflected forms are traced back to the base word first, for example `studies`, `running`, `went`, `better`.
3. Type a short Chinese phrase to find the matching English entries.
4. Whole sentences or paragraphs are beyond the dictionary; it tells you to switch to an online translation service.

The dictionary has about 11,700 common words, phrases and software terms. It is for looking up words, not translating sentences.

This plugin has no settings.

### What it uses

- Reads only the word list that ships with the plugin.
- No network access, no account or key, and the words you look up are never sent anywhere.

### Data source and license

The plugin code is released under the MIT License. The word list `assets/ecdict.json` comes from the open-source project [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT) (commit `39cfb9672c0906b63569e0453c2e6abfb9ab182a`, `Copyright (c) 2025 Linwei`, MIT License); see `LICENSE` in this folder for the full copyright and license notices.

---

## 给开发者 · For developers

- 接缝：`translator.engines`，注册的引擎 id 是 `ecdict`
- 在本目录 `pnpm build` 构建；写插件看[插件文档](https://github.com/TixXin/fuyu/blob/main/docs/plugins/README.md)。
