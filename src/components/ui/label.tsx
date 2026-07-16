import { type LabelHTMLAttributes } from "react";
import { clsx } from "clsx";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx(
        "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300",
        className
      )}
      {...props}
    />
  );
}
