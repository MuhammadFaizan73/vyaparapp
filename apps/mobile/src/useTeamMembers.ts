import { useEffect, useState } from "react";
import { api } from "./auth";
import type { TeamMember } from "@vyapar/api-client";

// Shared by every transaction list's Salesman filter — fetched once per screen mount
// rather than adding a new endpoint, since GET /team already returns everything
// needed (id + name) and is cheap/tenant-scoped.
export function useTeamMembers() {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    api.listTeamMembers().then(setTeamMembers).catch(() => {});
  }, []);

  return teamMembers;
}
