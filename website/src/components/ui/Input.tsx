import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    const id = props.id || props.name;
    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-star-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`
            w-full px-3 py-2 bg-void-700 border border-void-500/60 text-star-100
            placeholder:text-star-400 focus:outline-none focus:ring-2 focus:ring-nebula/30
            focus:border-nebula/50 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-redshift/50 focus:ring-redshift/30 focus:border-redshift/50' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-sm text-redshift">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
