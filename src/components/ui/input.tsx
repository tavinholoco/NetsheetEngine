import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded border border-field bg-surface px-3 py-1 text-xs text-fg-strong font-mono shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-bold placeholder:text-faint focus-visible:outline-none focus-visible:border-accent-400 focus-visible:ring-1 focus-visible:ring-accent-400 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
