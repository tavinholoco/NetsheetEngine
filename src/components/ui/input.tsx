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
          "flex h-9 w-full rounded border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-100 font-mono shadow-sm transition-colors file:border-0 file:bg-transparent file:text-xs file:font-bold placeholder:text-slate-600 focus-visible:outline-none focus-visible:border-cyan-400 focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50",
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
