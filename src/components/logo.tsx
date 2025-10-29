import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-primary/20 text-primary rounded-lg p-2 flex items-center justify-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
        >
          <path d="M9 9h4a3 3 0 0 1 0 6H9v6" />
          <path d="M9 9v12" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-foreground font-logo">PayParent</h1>
    </div>
  );
}
