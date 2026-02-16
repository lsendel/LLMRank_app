"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { useApiSWR } from "@/lib/use-api-swr";
import { api, type Team, type TeamDetail } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/lib/auth-hooks";
import { MemberList } from "@/components/team/member-list";
import { InviteDialog } from "@/components/team/invite-dialog";

export default function TeamPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const {
    data: teams,
    isLoading,
    mutate: mutateTeams,
  } = useApiSWR<Team[]>(
    "teams",
    useCallback(() => api.teams.list(), []),
  );

  // If user has a team, fetch its details
  const activeTeam = teams?.[0];
  const { data: teamDetail, mutate: mutateDetail } = useApiSWR<TeamDetail>(
    activeTeam ? `team-${activeTeam.id}` : null,
    useCallback(() => api.teams.getById(activeTeam!.id), [activeTeam?.id]),
  );

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      await api.teams.create(teamName.trim());
      setTeamName("");
      await mutateTeams();
      toast({ title: "Team created!" });
    } catch {
      toast({ title: "Failed to create team", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  // No team yet — show creation form
  if (!activeTeam) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div>
          <Link
            href="/dashboard"
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Create a Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Collaborate with your colleagues on AI readiness projects
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="team-name" className="text-sm font-medium">
                  Team Name
                </label>
                <Input
                  id="team-name"
                  placeholder="My Agency"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={creating || !teamName.trim()}>
                <Users className="mr-2 h-4 w-4" />
                {creating ? "Creating..." : "Create Team"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Has a team — show management UI
  const currentMember = teamDetail?.members.find((m) => m.userId === user?.id);
  const currentRole = currentMember?.role ?? "viewer";
  const canInvite = currentRole === "owner" || currentRole === "admin";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {activeTeam.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {teamDetail?.members.length ?? 0} member
              {(teamDetail?.members.length ?? 0) !== 1 ? "s" : ""}
            </p>
          </div>
          {canInvite && (
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Members</CardTitle>
          <CardDescription>
            Manage roles and access for your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teamDetail ? (
            <MemberList
              teamId={activeTeam.id}
              members={teamDetail.members}
              currentUserId={user?.id ?? ""}
              currentUserRole={currentRole}
              onMutate={() => mutateDetail()}
            />
          ) : (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading members...
            </div>
          )}
        </CardContent>
      </Card>

      {canInvite && (
        <InviteDialog
          teamId={activeTeam.id}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onInvited={() => mutateDetail()}
        />
      )}
    </div>
  );
}
