import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-primary/20 text-primary rounded-lg p-2 flex items-center justify-center">
        <Users className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-bold font-logo">
        <span className="text-primary">Pay</span><span className="text-foreground">Parent</span>
      </h1>
    </div>
  );
}
