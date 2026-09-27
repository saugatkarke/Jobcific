"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "@/lib/auth-client";
import { viewerAvatarUrl } from "@/lib/avatar";
import { usePageShowReset } from "./BusyButton";

type SessionState = {
  email: string | null;
  name: string | null;
  avatar: string | null;
  loading: boolean;
  signingOut: boolean;
  setAvatar: (url: string) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState>({
  email: null,
  name: null,
  avatar: null,
  loading: true,
  signingOut: false,
  setAvatar: () => {},
  signOut: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  usePageShowReset(setSigningOut);

  useEffect(() => {
    let cancelled = false;
    authClient
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        setEmail(data?.user?.email || null);
        setName(data?.user?.name || null);
        setAvatar(
          data?.user ? viewerAvatarUrl(data.user.image, data.user.id) : null,
        );
      })
      .catch(() => {
        if (cancelled) return;
        setEmail(null);
        setName(null);
        setAvatar(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/";
          },
          onError: () => setSigningOut(false),
        },
      });
    } catch {
      setSigningOut(false);
    }
  }

  const value = useMemo(
    () => ({ email, name, avatar, loading, signingOut, setAvatar, signOut }),
    [email, name, avatar, loading, signingOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
