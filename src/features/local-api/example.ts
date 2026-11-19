export type LocalApiExampleInput = {
  url: string;
  configPath: string;
  windows: boolean;
};

export function localApiExample({ url, configPath, windows }: LocalApiExampleInput): string {
  if (windows) {
    return [
      `$config = Get-Content "${configPath}" | ConvertFrom-Json`,
      `Invoke-RestMethod "${url}/health" -Headers @{ Authorization = "Bearer $($config.token)" }`,
    ].join("\n");
  }
  return [
    `TOKEN=$(sed -n 's/.*"token": *"\\([^"]*\\)".*/\\1/p' "${configPath}")`,
    `curl -H "Authorization: Bearer $TOKEN" ${url}/health`,
  ].join("\n");
}
