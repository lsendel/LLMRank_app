"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { api, type TeamMember } from "@/lib/api";
import { Shield, UserMinus } from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-blue-100 text-blue-800 border-blue-200",
  editor: "bg-green-100 text-green-800 border-green-200",
  viewer: "bg-gray-100 text-gray-800 border-gray-200",
};

export function MemberList({
  teamId,
  members,
  currentUserId,
  currentUserRole,
  onMutate,
}: {
  teamId: string;
  members: TeamMember[];
  currentUserId: string;
  currentUserRole: string;
  onMutate: () => void;
}) {
  const { toast } = useToast();
  const canManage = currentUserRole === "owner" || currentUserRole === "admin";

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      await api.teams.updateRole(teamId, memberId, newRole);
      onMutate();
      toast({ title: "Role updated" });
    } catch {
      toast({ title: "Failed to update role", variant: "destructive" });
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try {
      await api.teams.removeMember(teamId, memberId);
      onMutate();
      toast({ title: "Member removed" });
    } catch {
      toast({ title: "Failed to remove member", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const isOwner = member.role === "owner";
        const isSelf = member.userId === currentUserId;

        return (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {(member.name ?? member.email)?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <p className="text-sm font-medium">
                  {member.name ?? member.email}
                  {isSelf && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </p>
                {member.name && (
                  <p className="text-xs text-muted-foreground">
                    {member.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canManage && !isOwner && !isSelf ? (
                <>
                  <Select
                    value={member.role}
                    onValueChange={(val) => handleRoleChange(member.id, val)}
                  >
                    <SelectTrigger className="h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleRemove(member.id, member.name ?? member.email)
                    }
                  >
                    <UserMinus className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              ) : (
                <Badge
                  variant="outline"
                  className={ROLE_COLORS[member.role] ?? ""}
                >
                  <Shield className="mr-1 h-3 w-3" />
                  {member.role}
                </Badge>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
