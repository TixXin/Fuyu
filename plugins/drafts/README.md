# 还没上架的官方插件

这里的插件写好了、有测试，但还没打包签名。`plugins/examples/` 里的每个插件都必须在 `plugins/index.json` 里有签过名的条目（`pnpm test` 会检查），而签名私钥只在 Windows 那台机器上，所以在别的机器上写的新插件先放在这里。

上架时：把文件夹移到 `plugins/examples/`，在 `plugins/market/` 加上 `<id>.json`，运行 `pnpm plugins:index`，把测试里的路径一起改掉。
