"use client";

import { useEffect } from "react";
import { pushPurchase } from "@/lib/gtm";

export function PushPurchase({
  interval,
  value,
}: {
  interval: "monthly" | "yearly";
  value: number;
}) {
  useEffect(() => {
    pushPurchase({ interval, value });
  }, [interval, value]);

  return null;
}
