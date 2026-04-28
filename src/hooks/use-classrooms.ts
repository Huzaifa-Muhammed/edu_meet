"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api/client";
import type { Classroom } from "@/shared/types/domain";

export function useClassrooms() {
  return useQuery({
    queryKey: ["classrooms"],
    queryFn: () => api.get("/classrooms") as unknown as Promise<Classroom[]>,
  });
}

export function useClassroom(id: string | null | undefined) {
  return useQuery({
    queryKey: ["classroom", id],
    queryFn: () => api.get(`/classrooms/${id}`) as unknown as Promise<Classroom>,
    enabled: !!id,
  });
}

export function useClassroomStudents(id: string | null | undefined) {
  return useQuery({
    queryKey: ["classroom-students", id],
    queryFn: () =>
      api.get(`/classrooms/${id}/students`) as unknown as Promise<
        Array<{ uid: string; displayName?: string; email?: string; photoUrl?: string }>
      >,
    enabled: !!id,
  });
}
