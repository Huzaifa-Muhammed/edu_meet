import "server-only";
import { adminDb } from "@/server/firebase-admin";
import { Collections } from "@/shared/constants/collections";

/** Pre-bound Firestore collection references */
export const usersCol = () => adminDb.collection(Collections.USERS);
export const subjectsCol = () => adminDb.collection(Collections.SUBJECTS);
export const classroomsCol = () => adminDb.collection(Collections.CLASSROOMS);
export const agendasCol = () => adminDb.collection(Collections.AGENDAS);
export const notesCol = () => adminDb.collection(Collections.NOTES);
export const resourcesCol = () => adminDb.collection(Collections.RESOURCES);
export const meetingsCol = () => adminDb.collection(Collections.MEETINGS);
export const mediaCol = () => adminDb.collection(Collections.MEDIA);
export const quizzesCol = () => adminDb.collection(Collections.QUIZZES);
export const assessmentsCol = () => adminDb.collection(Collections.ASSESSMENTS);
export const paymentsCol = () => adminDb.collection(Collections.PAYMENTS);
export const summariesCol = () => adminDb.collection(Collections.SUMMARIES);
