import { forwardRef, type SelectHTMLAttributes } from "react";
import { clsx } from "clsx";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={clsx(
        "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900",
        "transition-shadow duration-150",
        "focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15",
        "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
        "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/15",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
