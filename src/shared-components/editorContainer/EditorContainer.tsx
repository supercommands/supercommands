import * as React from 'react';
import { forwardRef } from 'react';

export interface EditorContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  style?: React.CSSProperties;
  innerStyle?: React.CSSProperties;
}

export const EditorContainer = forwardRef<HTMLDivElement, EditorContainerProps>(
  ({ children, className = '', innerClassName = '', style, innerStyle, ...rest }, ref) => {
    return (
      <div className={className} style={style} {...rest}>
        <div ref={ref} className={innerClassName} style={innerStyle}>
          {children}
        </div>
      </div>
    );
  }
);
