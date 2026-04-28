import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { notFound } from "@/server/utils/errors";

/** Get a document or throw 404 */
export async function getDocOrFail<T>(
  collection: string,
  id: string,
): Promise<T & { id: string }> {
  const doc = await adminDb.collection(collection).doc(id).get();
  if (!doc.exists) throw notFound(collection);
  return { id: doc.id, ...(doc.data() as T) };
}

/** Create a document and return the generated ID */
export async function createDoc<T extends Record<string, unknown>>(
  collection: string,
  data: T,
): Promise<string> {
  const ref = await adminDb.collection(collection).add(data);
  return ref.id;
}

/** Update a document */
export async function updateDoc(
  collection: string,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  await adminDb.collection(collection).doc(id).update(data);
}

/** Delete a document */
export async function deleteDoc(
  collection: string,
  id: string,
): Promise<void> {
  await adminDb.collection(collection).doc(id).delete();
}
