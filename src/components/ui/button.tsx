import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-400 disabled:pointer-events-none disabled:opacity-50 cursor-pointer font-mono active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-accent-500 hover:bg-accent-400 text-black font-extrabold shadow-glow-15 shadow-accent-500/40",
        cyber:
          "bg-signal-400 hover:bg-signal-300 text-black font-extrabold shadow-glow-15 shadow-signal-400/40",
        destructive:
          "bg-red-600 hover:bg-red-500 text-white font-bold shadow-[0_0_12px_rgba(239,68,68,0.4)]",
        outline:
          "border border-accent-500/60 bg-surface hover:bg-accent-950/40 text-accent-400 hover:border-accent-400",
        secondary:
          "bg-raised-strong hover:bg-night-700 text-fg border border-line-strong",
        ghost:
          "hover:bg-raised-strong/80 text-fg-soft hover:text-white",
        emerald:
          "bg-ok-500 hover:bg-ok-400 text-black font-extrabold shadow-glow-15 shadow-ok-500/40",
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
