import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";
import { badRequest, notFound } from "@/server/utils/errors";
import { brainTokensService } from "./brain-tokens.service";

export type Offer = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  costBT: number;
  badge?: "hot" | "new" | null;
  active: boolean;
  order?: number;
  createdAt?: string;
};

export type OfferRedemption = {
  id: string;
  uid: string;
  offerId: string;
  offerTitle: string;
  costBT: number;
  status: "pending" | "fulfilled";
  redeemedAt: string;
};

const SEED: Omit<Offer, "id" | "createdAt">[] = [
  {
    title: "Free Practice Session",
    description: "Unlock a bonus 1-on-1 practice session with your teacher.",
    emoji: "🎯",
    costBT: 10,
    badge: "hot",
    active: true,
    order: 1,
  },
  {
    title: "Study Pack PDF",
    description: "A curated PDF pack tailored to your current topic.",
    emoji: "📚",
    costBT: 5,
    active: true,
    order: 2,
  },
  {
    title: "Early Access Quiz",
    description: "Try the weekly quiz 24 hours before anyone else.",
    emoji: "⏰",
    costBT: 8,
    active: true,
    order: 3,
  },
  {
    title: "Leaderboard Boost",
    description: "Double brain-token reward on your next correct answer.",
    emoji: "🏆",
    costBT: 6,
    badge: "new",
    active: true,
    order: 4,
  },
  {
    title: "Custom Theme Unlock",
    description: "Unlock an alternative student-portal theme (e.g. Forest).",
    emoji: "🎨",
    costBT: 15,
    active: true,
    order: 5,
  },
  {
    title: "Ask the Teacher — Priority",
    description: "Your next question goes to the top of the teacher's Q&A list.",
    emoji: "💬",
    costBT: 4,
    active: true,
    order: 6,
  },
];

export const offersService = {
  async ensureSeed() {
    const snap = await adminDb.collection(Collections.OFFERS).limit(1).get();
    if (!snap.empty) return;
    const batch = adminDb.batch();
    const now = new Date().toISOString();
    for (const o of SEED) {
      const ref = adminDb.collection(Collections.OFFERS).doc();
      batch.set(ref, { ...o, createdAt: now });
    }
    await batch.commit();
  },

  async list(): Promise<Offer[]> {
    await this.ensureSeed();
    const snap = await adminDb
      .collection(Collections.OFFERS)
      .where("active", "==", true)
      .get();
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<Offer, "id">) }),
    );
    items.sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    return items;
  },

  async listRedemptions(uid: string): Promise<OfferRedemption[]> {
    const snap = await adminDb
      .collection(Collections.OFFER_REDEMPTIONS)
      .where("uid", "==", uid)
      .orderBy("redeemedAt", "desc")
      .get();
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<OfferRedemption, "id">) }),
    );
  },

  async redeem(uid: string, offerId: string) {
    const offerRef = adminDb.collection(Collections.OFFERS).doc(offerId);
    const offerSnap = await offerRef.get();
    if (!offerSnap.exists) throw notFound("Offer");
    const offer = { id: offerSnap.id, ...(offerSnap.data() as Omit<Offer, "id">) };
    if (!offer.active) throw badRequest("Offer is no longer active");

    const tokens = await brainTokensService.get(uid);
    if (tokens.balance < offer.costBT)
      throw badRequest("Not enough Brain Tokens to redeem this offer");

    // Debit first — ledger-backed.
    await brainTokensService.debit(uid, offer.costBT, {
      reason: "offer_redemption",
      title: `Redeemed — ${offer.title}`,
      source: "Offers",
      offerId: offer.id,
    });

    const redemptionRef = adminDb.collection(Collections.OFFER_REDEMPTIONS).doc();
    const redemption: Omit<OfferRedemption, "id"> = {
      uid,
      offerId: offer.id,
      offerTitle: offer.title,
      costBT: offer.costBT,
      status: "pending",
      redeemedAt: new Date().toISOString(),
    };
    await redemptionRef.set(redemption);
    return { id: redemptionRef.id, ...redemption };
  },
};
