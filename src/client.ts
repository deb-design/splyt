import { request, APIRequestContext } from '@playwright/test';

async function jsonSafe<T>(res: any): Promise<T | undefined> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

export async function newApiContext(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { 'Content-Type': 'application/json' } });
}

export async function post<T>(ctx: APIRequestContext, path: string, body: unknown) {
  const res = await ctx.post(path, { data: body });
  return { res, json: await jsonSafe<T>(res) };
}

export async function patch<T>(ctx: APIRequestContext, path: string, body: unknown) {
  const res = await ctx.patch(path, { data: body });
  return { res, json: await jsonSafe<T>(res) };
}

export async function get<T>(ctx: APIRequestContext, path: string) {
  const res = await ctx.get(path);
  return { res, json: await jsonSafe<T>(res) };
}
