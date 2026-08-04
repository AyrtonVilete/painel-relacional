import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900",
          "placeholder:text-slate-400",
          "transition-shadow duration-150",
          "focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15",
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
          "dark:placeholder:text-slate-500",
          "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15",
          "dark:disabled:bg-slate-800 dark:disabled:text-slate-500",
          className
        )}
        {...props}
      />
    );
  }
);
