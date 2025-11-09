import { cn } from "@/lib/utils";
import { Users } from 'lucide-react';
import Image from "next/image";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-md">
        <Users className="h-5 w-5 text-secondary-foreground" />
      </div>
      <h1 className="text-xl font-bold font-logo">
        <span className="text-primary">Pay</span><span className="text-foreground">Parent</span>
      </h1>
    </div>
  );
}
