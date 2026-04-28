export const dynamic = "force-dynamic";
import "server-only";
import { NextRequest } from "next/server";
import { verifyToken } from "@/server/auth/verify-token";
import { requireRole } from "@/server/auth/require-role";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { ok, fail } from "@/server/utils/response";

type UserLite = {
  uid: string;
  displayName?: string;
  email?: string;
  photoUrl?: string;
};

type Classmate = UserLite & { classroomId: string; classroomName?: string };

type LeaderboardRow = UserLite & { weekEarned: number };

type Announcement = {
  id: string;
  kind: "note" | "slide" | "agenda" | "question";
  title: string;
  sub: string;
  at: string;
  dot: "red" | "green" | "amber" | "indigo";
};

/** Social rail data for the student dashboard's right sidebar.
 *  Returns classmates (across enrolled classrooms), a weekly BT leaderboard
 *  scoped to those classrooms, and recent class-scoped announcements. */
export async function GET(req: NextRequest) {
  try {
    const user = await verifyToken(req);
    requireRole(user, ["student"]);

    // 1) Enrolled classrooms
    const classSnap = await adminDb
      .collection(Collections.CLASSROOMS)
      .where("studentIds", "array-contains", user.uid)
      .get();

    const classrooms = classSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as { name?: string; studentIds?: string[] }),
    }));
    const classroomIds = new Set(classrooms.map((c) => c.id));
    const classmateIds = new Set<string>();
    for (const c of classrooms) for (const uid of c.studentIds ?? []) classmateIds.add(uid);
    classmateIds.delete(user.uid);

    // 2) Hydrate classmate profiles (cap to 20 to avoid blowing the request)
    const classmateArr = Array.from(classmateIds).slice(0, 20);
    const classmates: Classmate[] = await Promise.all(
      classmateArr.map(async (uid) => {
        const d = await adminDb.collection(Collections.USERS).doc(uid).get();
        const data = (d.data() ?? {}) as {
          displayName?: string;
          email?: string;
          photoUrl?: string;
        };
        const belongsTo = classrooms.find((c) => (c.studentIds ?? []).includes(uid));
        return {
          uid,
          displayName: data.displayName,
          email: data.email,
          photoUrl: data.photoUrl,
          classroomId: belongsTo?.id ?? "",
          classroomName: belongsTo?.name,
        };
      }),
    );

    // 3) Leaderboard — top weekEarned across classmates + self
    const boardIds = [user.uid, ...classmateArr];
    const rows: LeaderboardRow[] = await Promise.all(
      boardIds.map(async (uid) => {
        const d = await adminDb.collection(Collections.BRAIN_TOKENS).doc(uid).get();
        const tok = (d.data() ?? null) as { weekEarned?: number } | null;
        const u = await adminDb.collection(Collections.USERS).doc(uid).get();
        const udata = (u.data() ?? {}) as {
          displayName?: string;
          email?: string;
          photoUrl?: string;
        };
        return {
          uid,
          displayName: udata.displayName,
          email: udata.email,
          photoUrl: udata.photoUrl,
          weekEarned: tok?.weekEarned ?? 0,
        };
      }),
    );
    rows.sort((a, b) => b.weekEarned - a.weekEarned);

    // 4) Announcements — recent class notes + recent agenda items + recent slide uploads
    const announcements: Announcement[] = [];
    for (const cid of classroomIds) {
      const notesSnap = await adminDb
        .collection(Collections.NOTES)
        .where("classroomId", "==", cid)
        .limit(3)
        .get();
      for (const d of notesSnap.docs) {
        const data = d.data() as {
          text?: string;
          authorName?: string;
          authorRole?: string;
          createdAt?: string;
        };
        if (data.authorRole !== "teacher" && data.authorRole !== "admin") continue;
        announcements.push({
          id: `n_${d.id}`,
          kind: "note",
          title: truncate(data.text ?? "New note shared", 60),
          sub: `${data.authorName ?? "Teacher"} · ${relative(data.createdAt)}`,
          at: data.createdAt ?? new Date().toISOString(),
          dot: "indigo",
        });
      }
      const agendaSnap = await adminDb
        .collection(Collections.CLASSROOM_AGENDAS)
        .where("classroomId", "==", cid)
        .limit(3)
        .get();
      for (const d of agendaSnap.docs) {
        const data = d.data() as { title?: string; createdAt?: string; done?: boolean };
        announcements.push({
          id: `a_${d.id}`,
          kind: "agenda",
          title: data.title ?? "Agenda updated",
          sub: `Agenda · ${relative(data.createdAt)}`,
          at: data.createdAt ?? new Date().toISOString(),
          dot: data.done ? "green" : "amber",
        });
      }
    }
    announcements.sort((a, b) => b.at.localeCompare(a.at));

    return ok({
      classmates: classmates.slice(0, 8),
      leaderboard: rows.slice(0, 5),
      announcements: announcements.slice(0, 5),
      me: { uid: user.uid },
    });
  } catch (e) {
    return fail(e);
  }
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…";
}

function relative(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}
