"use client";

import { useEffect } from "react";
import { pushExtensionConnect } from "@/lib/gtm";

export function PushExtensionConnect({ userId }: { userId: string }) {
  useEffect(() => {
    pushExtensionConnect(userId);
  }, [userId]);

  return null;
}
