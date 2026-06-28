import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none cursor-pointer";
  const widthStyles = fullWidth ? "w-full" : "";

  const variants = {
    primary:
      "bg-transparent text-nebula border border-void-500/50 hover:bg-nebula/10 hover:text-white hover:border-nebula/30 focus-visible:ring-2 focus-visible:ring-nebula/30",
    secondary:
      "bg-void-700 text-star-200 border border-void-500/50 hover:bg-void-600 focus-visible:ring-2 focus-visible:ring-star-300/50",
    ghost:
      "bg-transparent text-star-300 hover:bg-void-600 hover:text-star-100 focus-visible:ring-2 focus-visible:ring-void-500",
    destructive:
      "bg-transparent text-redshift border border-void-500/50 hover:bg-redshift/10 hover:border-redshift/30 focus-visible:ring-2 focus-visible:ring-redshift/30",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${widthStyles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
