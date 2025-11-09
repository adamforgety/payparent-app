import { cn } from "@/lib/utils";
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image src="/icons/icon.svg" alt="PayParent Logo" width={32} height={32} />
      <h1 className="text-xl font-bold font-logo">
        <span className="text-primary">Pay</span><span className="text-foreground">Parent</span>
      </h1>
    </div>
  );
}
