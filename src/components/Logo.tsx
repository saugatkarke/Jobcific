import Image from "next/image";
import { APP_NAME } from "@/lib/copy";

export function Logo({
  className = "h-16 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/Jobcific-logo-transparent.svg"
      alt={APP_NAME}
      width={1077}
      height={453}
      className={`object-contain ${className}`}
      priority={priority}
      unoptimized
    />
  );
}
