"use client";

import React, { type ReactNode } from "react";
import { useSession, signOut as betterSignOut } from "./auth-client";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useAuth() {
  const { data: session, isPending } = useSession();
  return {
    userId: session?.user?.id ?? null,
    isLoaded: !isPending,
    isSignedIn: !!session?.user,
    signOut: async () => {
      await betterSignOut();
      window.location.href = "/sign-in";
    },
  };
}

export function useUser() {
  const { data: session, isPending } = useSession();
  const user = session?.user;
  return {
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          image:
            user.image ??
            `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`,
        }
      : null,
    isLoaded: !isPending,
    isSignedIn: !!user,
  };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function SignedIn({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return session?.user ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  return !session?.user ? <>{children}</> : null;
}

export function UserButton() {
  const { user } = useUser();
  const router = useRouter();

  if (!user) return null;

  return (
    <div
      className="flex items-center gap-2 cursor-pointer"
      onClick={async () => {
        await betterSignOut();
        router.push("/sign-in");
      }}
    >
      <img
        src={user.image}
        alt={user.name ?? "User"}
        className="h-8 w-8 rounded-full border"
      />
    </div>
  );
}
