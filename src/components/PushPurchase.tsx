"use client";

import { useEffect } from "react";
import { pushPurchase, type PlanEventInput } from "@/lib/gtm";

export function PushPurchase({ interval, plan, value }: PlanEventInput) {
  useEffect(() => {
    pushPurchase({ interval, plan, value });
  }, [interval, plan, value]);

  return null;
}
