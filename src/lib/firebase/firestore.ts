import {
  collection,
  doc,
  onSnapshot,
  query,
  type Query,
  type DocumentData,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";

/**
 * Subscribe to a Firestore query, returning an unsubscribe function.
 */
export function subscribeToQuery<T>(
  collectionPath: string,
  constraints: QueryConstraint[],
  onData: (items: (T & { id: string })[]) => void,
  onError?: (err: Error) => void,
) {
  const q: Query<DocumentData> = query(
    collection(getFirebaseDb(), collectionPath),
    ...constraints,
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as T),
      }));
      onData(items);
    },
    onError,
  );
}

/**
 * Subscribe to a single Firestore document.
 */
export function subscribeToDoc<T>(
  collectionPath: string,
  docId: string,
  onData: (data: (T & { id: string }) | null) => void,
  onError?: (err: Error) => void,
) {
  const ref = doc(getFirebaseDb(), collectionPath, docId);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      onData({ id: snapshot.id, ...(snapshot.data() as T) });
    },
    onError,
  );
}
