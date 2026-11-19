export type LocalApiExampleInput = { url: string; configPath: string; windows: boolean; notify?: boolean };

const NOTICE = '{"source":"demo","name":"Demo","title":"Hello from the local API"}';

export function localApiExample({ url, configPath, windows, notify = false }: LocalApiExampleInput): string {
  if (windows) {
    const headers = '-Headers @{ Authorization = "Bearer $($config.token)" }';
    return [
      `$config = Get-Content "${configPath}" | ConvertFrom-Json`,
      notify
        ? `Invoke-RestMethod "${url}/notify" -Method Post ${headers} -ContentType "application/json" -Body '${NOTICE}'`
        : `Invoke-RestMethod "${url}/health" ${headers}`,
    ].join("\n");
  }
  return [
    `TOKEN=$(sed -n 's/.*"token": *"\\([^"]*\\)".*/\\1/p' "${configPath}")`,
    notify
      ? `curl -X POST -H "Authorization: Bearer $TOKEN" -d '${NOTICE}' ${url}/notify`
      : `curl -H "Authorization: Bearer $TOKEN" ${url}/health`,
  ].join("\n");
}
