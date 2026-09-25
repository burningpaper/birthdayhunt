import "server-only";
import type { z } from "zod";

/** A JSON error with a message a parent can act on. */
export function jsonError(status: number, error: string, extra: Record<string, unknown> = {}) {
  return Response.json({ error, ...extra }, { status });
}

/** Parse and validate a JSON body. Returns the data, or a 400 response. */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: jsonError(400, "The request was not valid JSON.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    console.warn("[api] rejected body", result.error.issues);
    return { response: jsonError(400, "Some of that data was not valid.", { issues: result.error.issues }) };
  }
  return { data: result.data };
}

/** Best-effort client IP for rate limiting. Vercel sets x-forwarded-for. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}
