# create-fuyu-plugin

Creates a [Fuyu](https://github.com/TixXin/fuyu) plugin:

```sh
npm create fuyu-plugin@latest [folder]
```

It asks for the language (PowerShell, TypeScript or JavaScript), a template (a command, an island page with a list, a status text on the collapsed island, or blank), your name, the plugin's names and its id, then writes the manifest, the code with the SDK in `lib/`, a test that runs under the mock host, `.fuyuignore`, README, LICENSE and a GitHub Actions workflow that checks the plugin and publishes a release for each version tag.

Skip the questions with `-- --language typescript --template list --author you --id you.my-plugin --name "My plugin" --name-zh 我的插件 --yes`.

Guide (Chinese): [docs/plugins/quickstart.md](https://github.com/TixXin/fuyu/blob/main/docs/plugins/quickstart.md).
