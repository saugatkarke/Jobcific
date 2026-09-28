"use client";

import { useEffect } from "react";
import { pushEmailVerified } from "@/lib/gtm";

export function PushEmailVerified({ userId }: { userId: string }) {
  useEffect(() => {
    pushEmailVerified(userId);
  }, [userId]);

  return null;
}
