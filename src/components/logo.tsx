import { cn } from "@/lib/utils";
import { Users } from 'lucide-react';
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md">
        <Image src="/icons/pwa-icon.svg" alt="PayParent Logo" width={28} height={28} />
      </div>
      <h1 className="text-xl font-bold font-logo">
        <span className="text-primary">Pay</span><span className="text-foreground">Parent</span>
      </h1>
    </div>
  );
}
