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

  async listAll(status?: "open" | "resolved"): Promise<SupportTicket[]> {
    let q: FirebaseFirestore.Query = adminDb.collection(
      Collections.SUPPORT_TICKETS,
    );
    if (status) q = q.where("status", "==", status);
    const snap = await q.get();
    const tickets = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SupportTicket, "id">),
    })) as SupportTicket[];
    tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return tickets;
  },

  async setStatus(id: string, status: "open" | "resolved") {
    await adminDb.collection(Collections.SUPPORT_TICKETS).doc(id).update({
      status,
    });
    return { id, status };
  },
};
