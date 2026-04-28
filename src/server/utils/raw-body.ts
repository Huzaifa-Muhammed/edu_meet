import "server-only";

/**
 * Read raw body text from a request — needed for Stripe webhook signature verification.
 * Must be called BEFORE any JSON parsing.
 */
export async function getRawBody(req: Request): Promise<string> {
  return await req.text();
}
