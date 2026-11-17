# @fuyu/ecdict

浮屿（Fuyu）官方离线英汉词典插件，通过 `translator.engines` 接缝注册免密钥查词引擎 **ECDICT 离线词典 / ECDICT Offline Dictionary**（`ecdict`）。

## 功能特点

- **零配置免密钥**：启用插件后即可在「设置 → 翻译 → 翻译服务」下拉框中选择「ECDICT 离线词典」，无需填写任何云厂商 API Key 或模型名称。
- **纯本地离线运行**：不声明任何网络域名权限，毫秒级响应。
- **英查中与词形还原**：内置约 1.17 万条核心高频词汇、常用英文短语及软件工程术语，支持大小写不敏感查询、去首尾标点，以及规则与不规则词形变化还原（`-s/-es/-ies`、`-ed/-ied`、`-ing`、`-er/-est` 与常见不规则动词/名词变化），展示原形说明、音标与多义项中文释义。
- **简明中查英与长句提示**：输入简短中文词组时反向匹配对应英文词条；输入超出词典收录范围的整句或段落时，返回清晰友好的中英文引导提示。

## 数据来源与开源许可

本插件代码基于 MIT License 发布。内置核心词表 `assets/ecdict.json` 提取自开源项目 [skywind3000/ECDICT](https://github.com/skywind3000/ECDICT)（提交 `39cfb9672c0906b63569e0453c2e6abfb9ab182a`，`Copyright (c) 2025 Linwei`，MIT License），完整版权与许可声明见同目录 `LICENSE`。
