import "server-only";
import { Resend } from "resend";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

let _client: Resend | null = null;

function getClient(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  _client = new Resend(key);
  return _client;
}

export type SendEmailInput = {
  to: string;
  subject: string;
  react: ReactElement;
  /** Used for the audit log so we can group sends by template. */
  templateKey: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string | null; transport: "resend" | "console" }
  | { ok: false; error: string };

/**
 * Send a transactional email. Never throws — logs failures and returns a
 * structured result so callers can fire-and-forget without breaking flows.
 *
 * Honors EMAIL_TRANSPORT:
 *  - "console" (default in dev) → renders + logs to terminal, no API call
 *  - "resend"                   → real send via Resend
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const transport =
    (process.env.EMAIL_TRANSPORT?.trim() as "resend" | "console" | undefined) ??
    (process.env.NODE_ENV === "production" ? "resend" : "console");

  const from =
    process.env.EMAIL_FROM?.trim() || "EduMeet <onboarding@resend.dev>";
  const replyTo = input.replyTo ?? process.env.EMAIL_REPLY_TO?.trim();

  let html = "";
  let text = "";
  try {
    [html, text] = await Promise.all([
      render(input.react),
      render(input.react, { plainText: true }),
    ]);
  } catch (err) {
    const error = err instanceof Error ? err.message : "Render failed";
    await logEmail({
      to: input.to,
      subject: input.subject,
      templateKey: input.templateKey,
      transport,
      status: "failed",
      error,
    });
    return { ok: false, error };
  }

  if (transport === "console") {
    console.info(
      `\n[email:console] to=${input.to} subject="${input.subject}" template=${input.templateKey}\n${text}\n`,
    );
    await logEmail({
      to: input.to,
      subject: input.subject,
      templateKey: input.templateKey,
      transport,
      status: "sent",
    });
    return { ok: true, id: null, transport: "console" };
  }

  try {
    const res = await getClient().emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html,
      text,
      replyTo: replyTo && replyTo.length > 0 ? replyTo : undefined,
    });
    if (res.error) {
      const error = res.error.message ?? String(res.error);
      console.error("[email:resend]", error);
      await logEmail({
        to: input.to,
        subject: input.subject,
        templateKey: input.templateKey,
        transport,
        status: "failed",
        error,
      });
      return { ok: false, error };
    }
    await logEmail({
      to: input.to,
      subject: input.subject,
      templateKey: input.templateKey,
      transport,
      status: "sent",
      providerId: res.data?.id ?? null,
    });
    return { ok: true, id: res.data?.id ?? null, transport: "resend" };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Send failed";
    console.error("[email:resend]", err);
    await logEmail({
      to: input.to,
      subject: input.subject,
      templateKey: input.templateKey,
      transport,
      status: "failed",
      error,
    });
    return { ok: false, error };
  }
}

type LogInput = {
  to: string;
  subject: string;
  templateKey: string;
  transport: "resend" | "console";
  status: "sent" | "failed";
  providerId?: string | null;
  error?: string;
};

async function logEmail(entry: LogInput) {
  try {
    await adminDb.collection(Collections.EMAIL_LOG).add({
      ...entry,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    // Don't surface — logging failure shouldn't break the email flow.
    console.warn("[email:log] failed to write audit row", err);
  }
}
