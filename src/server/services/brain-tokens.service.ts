import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

export type TokenReason =
  | "teacher_reward"
  | "correct_answer"
  | "streak_bonus"
  | "quiz_top_scorer"
  | "participation"
  | "game_reward"
  | "offer_redemption"
  | "other";

export type TokenTransaction = {
  id: string;
  uid: string;
  amount: number;
  reason: TokenReason;
  title: string;
  source?: string;
  meetingId?: string;
  classroomId?: string;
  actorUid?: string;
  offerId?: string;
  createdAt: string;
};

export type AdjustInput = {
  reason: TokenReason;
  title: string;
  source?: string;
  meetingId?: string;
  classroomId?: string;
  actorUid?: string;
  offerId?: string;
};

export type BrainTokensDoc = {
  uid: string;
  balance: number;
  earnedTotal: number;
  spentTotal: number;
  lastStreakAt: string | null;
  streakDays: number;
  weekEarned: number;
  updatedAt: string;
};

function startOfISOWeek(d = new Date()) {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day + 6) % 7; // Monday start
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

export const brainTokensService = {
  async ensureDoc(uid: string): Promise<BrainTokensDoc> {
    const ref = adminDb.collection(Collections.BRAIN_TOKENS).doc(uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data() as BrainTokensDoc;
    const fresh: BrainTokensDoc = {
      uid,
      balance: 0,
      earnedTotal: 0,
      spentTotal: 0,
      lastStreakAt: null,
      streakDays: 0,
      weekEarned: 0,
      updatedAt: new Date().toISOString(),
    };
    await ref.set(fresh);
    return fresh;
  },

  async get(uid: string): Promise<BrainTokensDoc> {
    return this.ensureDoc(uid);
  },

  /**
   * Atomically credit (positive amount) or debit (negative amount) a user's
   * brain-token balance and append a ledger entry. Returns the new balance.
   */
  async adjust(
    uid: string,
    amount: number,
    input: AdjustInput,
  ): Promise<{ newBalance: number; transactionId: string }> {
    const balRef = adminDb.collection(Collections.BRAIN_TOKENS).doc(uid);
    const ledgerRef = adminDb.collection(Collections.TOKEN_TRANSACTIONS).doc();
    const now = new Date().toISOString();

    const weekStart = startOfISOWeek().toISOString();

    const newBalance = await adminDb.runTransaction(async (tx) => {
      const cur = await tx.get(balRef);
      const existing = (cur.exists ? (cur.data() as BrainTokensDoc) : null) ?? null;
      const prevBalance = existing?.balance ?? 0;

      // If current week start > stored week marker, reset weekEarned.
      const prevUpdated = existing?.updatedAt ?? "";
      const prevWeek = prevUpdated ? startOfISOWeek(new Date(prevUpdated)).toISOString() : "";
      const carryWeek = prevWeek === weekStart ? (existing?.weekEarned ?? 0) : 0;

      const next: BrainTokensDoc = {
        uid,
        balance: Math.max(0, prevBalance + amount),
        earnedTotal: (existing?.earnedTotal ?? 0) + (amount > 0 ? amount : 0),
        spentTotal: (existing?.spentTotal ?? 0) + (amount < 0 ? -amount : 0),
        lastStreakAt: existing?.lastStreakAt ?? null,
        streakDays: existing?.streakDays ?? 0,
        weekEarned: carryWeek + (amount > 0 ? amount : 0),
        updatedAt: now,
      };

      tx.set(balRef, next);
      tx.set(ledgerRef, {
        uid,
        amount,
        reason: input.reason,
        title: input.title,
        source: input.source ?? null,
        meetingId: input.meetingId ?? null,
        classroomId: input.classroomId ?? null,
        actorUid: input.actorUid ?? null,
        offerId: input.offerId ?? null,
        createdAt: now,
      });
      return next.balance;
    });

    return { newBalance, transactionId: ledgerRef.id };
  },

  async credit(uid: string, amount: number, input: AdjustInput) {
    if (amount <= 0) throw new Error("credit amount must be > 0");
    return this.adjust(uid, amount, input);
  },

  async debit(uid: string, amount: number, input: AdjustInput) {
    if (amount <= 0) throw new Error("debit amount must be > 0");
    return this.adjust(uid, -amount, input);
  },

  /**
   * Check + bump streak on login / dashboard open. Awards +2 BT if this is a
   * new day and the previous streak is still within 36h window.
   */
  async checkStreak(uid: string): Promise<{ streakDays: number; awarded: boolean }> {
    const ref = adminDb.collection(Collections.BRAIN_TOKENS).doc(uid);
    const snap = await ref.get();
    const existing = snap.exists ? (snap.data() as BrainTokensDoc) : null;
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const lastDay = existing?.lastStreakAt?.slice(0, 10);
    if (lastDay === today) {
      return { streakDays: existing?.streakDays ?? 1, awarded: false };
    }

    // How many days since last streak day?
    let newStreak = 1;
    if (lastDay) {
      const diffMs = Date.parse(today) - Date.parse(lastDay);
      const diffDays = Math.round(diffMs / 86_400_000);
      newStreak = diffDays === 1 ? (existing?.streakDays ?? 0) + 1 : 1;
    }

    await ref.set(
      {
        uid,
        lastStreakAt: now.toISOString(),
        streakDays: newStreak,
        updatedAt: now.toISOString(),
      },
      { merge: true },
    );

    // Credit streak bonus (+2 BT) for every successful day tick
    await this.credit(uid, 2, {
      reason: "streak_bonus",
      title: newStreak > 1 ? `${newStreak}-day streak bonus` : "Welcome streak bonus",
      source: "System",
    });

    return { streakDays: newStreak, awarded: true };
  },

  /** Total positive amount earned today by a given reason. Used to cap
   *  game rewards so a student can't farm BT indefinitely.
   *
   *  Combining two `==` filters with a `>=` range filter would require a
   *  composite index, so we filter on `uid + reason` in Firestore and
   *  bound the date in-memory. The per-student-per-reason ledger volume
   *  is tiny so this is cheap. */
  async todayEarnedByReason(uid: string, reason: TokenReason): Promise<number> {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayStartIso = todayStart.toISOString();
    const snap = await adminDb
      .collection(Collections.TOKEN_TRANSACTIONS)
      .where("uid", "==", uid)
      .where("reason", "==", reason)
      .get();
    let total = 0;
    for (const d of snap.docs) {
      const data = d.data() as { amount?: number; createdAt?: string };
      if (!data.createdAt || data.createdAt < todayStartIso) continue;
      const amt = data.amount ?? 0;
      if (amt > 0) total += amt;
    }
    return total;
  },

  async listTransactions(uid: string, limit = 50): Promise<TokenTransaction[]> {
    const snap = await adminDb
      .collection(Collections.TOKEN_TRANSACTIONS)
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<TokenTransaction, "id">) }),
    );
  },

  async dailyHistogram(uid: string, days = 13) {
    const snap = await adminDb
      .collection(Collections.TOKEN_TRANSACTIONS)
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();
    const buckets = new Map<string, number>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const doc of snap.docs) {
      const data = doc.data() as { amount: number; createdAt: string };
      const key = data.createdAt?.slice(0, 10);
      if (key && buckets.has(key)) {
        buckets.set(key, (buckets.get(key) ?? 0) + (data.amount > 0 ? data.amount : 0));
      }
    }
    return Array.from(buckets.entries()).map(([date, value]) => ({ date, value }));
  },
};

