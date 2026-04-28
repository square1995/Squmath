import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

const baseClass =
  "inline-flex items-center justify-center px-4 py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

const variantClass: Record<Variant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border border-slate-300 bg-white hover:bg-slate-50",
  danger: "border border-red-300 text-red-700 hover:bg-red-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", className = "", ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`${baseClass} ${variantClass[variant]} ${className}`}
        {...rest}
      />
    );
  },
);
