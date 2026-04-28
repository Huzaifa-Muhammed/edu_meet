import api from "./client";
import type { Meeting } from "@/shared/types/domain";

export async function getUpcomingMeetings(): Promise<Meeting[]> {
  return api.get("/meetings/upcoming") as unknown as Meeting[];
}

export async function getPastMeetings(): Promise<Meeting[]> {
  return api.get("/meetings/past") as unknown as Meeting[];
}

export async function createMeeting(data: {
  classroomId: string;
  scheduledAt?: string;
}): Promise<Meeting> {
  return api.post("/meetings", data) as unknown as Meeting;
}
