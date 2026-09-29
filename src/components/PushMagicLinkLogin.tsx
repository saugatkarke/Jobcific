"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { pushLogin } from "@/lib/gtm";

export function PushMagicLinkLogin() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("login") !== "magic_link") return;
    url.searchParams.delete("login");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
    authClient
      .getSession()
      .then(({ data }) => {
        const userId = data?.user?.id;
        if (!userId) return;
        pushLogin({ method: "magic_link", userId });
      })
      .catch(() => {});
  }, []);

  return null;
}
