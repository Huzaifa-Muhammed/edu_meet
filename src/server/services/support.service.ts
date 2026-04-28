import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

export type SupportTicket = {
  id: string;
  uid: string;
  problemType: "technical" | "lesson" | "account" | "other";
  subject: string;
  details: string;
  priority: "low" | "normal" | "high";
  status: "open" | "resolved";
  createdAt: string;
};

export const supportService = {
  async create(uid: string, data: Omit<SupportTicket, "id" | "uid" | "status" | "createdAt">) {
    const ref = adminDb.collection(Collections.SUPPORT_TICKETS).doc();
    const payload: Omit<SupportTicket, "id"> = {
      uid,
      ...data,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    await ref.set(payload);
    return { id: ref.id, ...payload };
  },
};
