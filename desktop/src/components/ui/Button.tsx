import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "ghost" | "accent" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors duration-100",
  accent:
    "bg-accent text-white hover:bg-accent-dim transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed",
  icon: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-colors duration-100",
};

const sizeClasses = {
  ghost: "px-2 py-1 text-xs font-ui",
  accent: "px-3 py-1.5 text-sm font-ui font-medium",
  icon: "p-1.5",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "ghost", className = "", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-1.5 rounded-sm focus-visible:ring-1 focus-visible:ring-accent/50 focus-visible:outline-none ${variantClasses[variant]} ${sizeClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
