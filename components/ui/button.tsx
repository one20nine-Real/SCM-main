import type { ButtonHTMLAttributes } from 'react';
export default function Button({ variant = 'default', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'primary' | 'ghost' }) {
  return <button className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}
