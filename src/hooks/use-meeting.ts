"use client";

import { useQuery } from "@tanstack/react-query";
import { getUpcomingMeetings, getPastMeetings } from "@/lib/api/meetings";

export function useUpcomingMeetings() {
  return useQuery({
    queryKey: ["meetings", "upcoming"],
    queryFn: getUpcomingMeetings,
  });
}

export function usePastMeetings() {
  return useQuery({
    queryKey: ["meetings", "past"],
    queryFn: getPastMeetings,
  });
}
