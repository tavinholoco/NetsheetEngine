import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-500/50 bg-cyan-950/60 text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.3)]",
        secondary:
          "border border-slate-700 bg-slate-900 text-slate-300",
        yellow:
          "border border-yellow-500/50 bg-yellow-950/60 text-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.3)]",
        emerald:
          "border border-emerald-500/50 bg-emerald-950/60 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]",
        destructive:
          "border border-red-500/50 bg-red-950/60 text-red-400 shadow-[0_0_8px_rgba(239,68,68,0.3)]",
        outline: "text-slate-300 border border-slate-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLProps<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  className?: string;
  children?: React.ReactNode;
}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
