import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { notFound } from "@/server/utils/errors";
import type { LeaveRequest } from "@/shared/types/domain";
import type { LeaveCreateInput, LeaveReviewInput } from "@/shared/schemas/leave.schema";

function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** Every date string from start..end inclusive. */
function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  // guard against pathological ranges
  for (let i = 0; i < 366 && cur <= end; i++) {
    out.push(cur);
    cur = addDaysStr(cur, 1);
  }
  return out;
}

export const leaveService = {
  async create(
    teacher: { uid: string; displayName?: string; email?: string },
    input: LeaveCreateInput,
  ) {
    const now = new Date();
    // Emergency: the leave starts within ~48 hours (or already today/past).
    const startMs = new Date(`${input.startDate}T00:00:00`).getTime();
    const hoursUntil = (startMs - now.getTime()) / 3_600_000;
    const emergency = hoursUntil <= 48;

    const data = {
      teacherId: teacher.uid,
      teacherName: teacher.displayName ?? "Teacher",
      teacherEmail: teacher.email ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? input.startDate,
      reason: input.reason,
      emergency,
      status: "pending" as const,
      createdAt: now.toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    };
    const ref = await adminDb.collection(Collections.LEAVE_REQUESTS).add(data);
    return { id: ref.id, ...data };
  },

  async getById(id: string): Promise<LeaveRequest> {
    const doc = await adminDb.collection(Collections.LEAVE_REQUESTS).doc(id).get();
    if (!doc.exists) throw notFound("Leave request");
    return { id: doc.id, ...(doc.data() as Omit<LeaveRequest, "id">) };
  },

  async listForTeacher(teacherId: string): Promise<LeaveRequest[]> {
    const snap = await adminDb
      .collection(Collections.LEAVE_REQUESTS)
      .where("teacherId", "==", teacherId)
      .get();
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, "id">) }));
    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return rows;
  },

  async listAll(status?: "pending" | "approved" | "rejected"): Promise<LeaveRequest[]> {
    const snap = await adminDb.collection(Collections.LEAVE_REQUESTS).get();
    let rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeaveRequest, "id">) }));
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
    return rows;
  },

  async countPending(): Promise<number> {
    const snap = await adminDb
      .collection(Collections.LEAVE_REQUESTS)
      .where("status", "==", "pending")
      .get();
    return snap.size;
  },

  async review(id: string, reviewerUid: string, input: LeaveReviewInput) {
    const ref = adminDb.collection(Collections.LEAVE_REQUESTS).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw notFound("Leave request");
    const reviewedAt = new Date().toISOString();
    await ref.set(
      {
        status: input.status,
        reviewedAt,
        reviewedBy: reviewerUid,
        reviewNote: input.reviewNote ?? null,
      },
      { merge: true },
    );
    return { id, status: input.status, reviewedAt };
  },

  /** Approved-leave dates for a teacher (optionally bounded to a prefix like
   *  "2026-06"), used by the scheduler to skip those days. */
  async approvedLeaveDates(teacherId: string, prefix?: string): Promise<Set<string>> {
    const snap = await adminDb
      .collection(Collections.LEAVE_REQUESTS)
      .where("teacherId", "==", teacherId)
      .get();
    const set = new Set<string>();
    for (const d of snap.docs) {
      const r = d.data() as LeaveRequest;
      if (r.status !== "approved") continue;
      for (const date of datesInRange(r.startDate, r.endDate || r.startDate)) {
        if (!prefix || date.startsWith(prefix)) set.add(date);
      }
    }
    return set;
  },
};
