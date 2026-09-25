import { useNavigate } from 'react-router-dom';
import React from 'react';

interface LinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  [key: string]: any;
}

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, onClick, ...props }, ref) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      onClick?.(e);
      navigate(href);
    };

    return (
      <a ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  }
);

Link.displayName = 'Link';

export default Link;
