import React from 'react';

interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  [key: string]: any;
}

export const Image = React.forwardRef<HTMLImageElement, ImageProps>(
  ({ src, alt, width, height, ...props }, ref) => (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={width}
      height={height}
      {...props}
    />
  )
);

Image.displayName = 'Image';

export default Image;
