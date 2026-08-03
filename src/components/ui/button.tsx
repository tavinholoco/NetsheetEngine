import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer font-mono active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold shadow-[0_0_15px_rgba(6,182,212,0.4)]",
        cyber:
          "bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold shadow-[0_0_15px_rgba(250,204,21,0.4)]",
        destructive:
          "bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)]",
        outline:
          "border border-cyan-500/60 bg-slate-950 hover:bg-cyan-950/40 text-cyan-400 hover:border-cyan-400",
        secondary:
          "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
        ghost:
          "hover:bg-slate-800/80 text-slate-300 hover:text-white",
        emerald:
          "bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold shadow-[0_0_15px_rgba(16,185,129,0.4)]",
        magenta:
          "bg-pink-600 hover:bg-pink-500 text-white font-extrabold shadow-[0_0_15px_rgba(219,39,119,0.4)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded px-3 text-[11px]",
        lg: "h-11 rounded-md px-8 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
