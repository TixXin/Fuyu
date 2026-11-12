import type { LocalApiResponse } from "./api";

export type LocalApiHandler = (params: unknown) => LocalApiResponse | Promise<LocalApiResponse>;
export type LocalApiHandlers = Record<string, LocalApiHandler>;

export async function dispatchLocalApiRequest(
  handlers: LocalApiHandlers,
  method: string,
  params: unknown,
): Promise<LocalApiResponse> {
  const handler = Object.prototype.hasOwnProperty.call(handlers, method) ? handlers[method] : undefined;

  if (!handler) {
    return { ok: false, status: 404, error: `Unknown method "${method}".` };
  }

  try {
    return await handler(params);
  } catch (error) {
    return {
      ok: false,
      status: 500,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
