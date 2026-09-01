import { cn } from "@/lib/utils/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[18px] w-[18px] text-white"
        aria-hidden
      >
        <rect x="3" y="3" width="7" height="18" rx="1.5" fill="currentColor" opacity="0.9" />
        <rect x="12" y="3" width="9" height="10" rx="1.5" fill="currentColor" opacity="0.55" />
        <rect x="12" y="15" width="9" height="6" rx="1.5" fill="currentColor" opacity="0.55" />
      </svg>
    </div>
  );
}
