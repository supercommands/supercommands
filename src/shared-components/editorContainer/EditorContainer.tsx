import * as React from 'react';
import { forwardRef } from 'react';
import { FUNCTIONAL_EDITOR_SURFACE_STYLE } from './functionalEditorSurfaceStyle';
export interface EditorContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    className?: string;
    innerClassName?: string;
    style?: React.CSSProperties;
    innerStyle?: React.CSSProperties;
    useBlackSurface?: boolean;
}
export const EditorContainer = forwardRef<HTMLDivElement, EditorContainerProps>(({ children, className = '', innerClassName = '', style, innerStyle, useBlackSurface = false, ...rest }, ref) => {
    return (<div className={className} style={useBlackSurface ? { ...style, ...FUNCTIONAL_EDITOR_SURFACE_STYLE } : style} data-black-editor-surface={useBlackSurface ? 'true' : undefined} {...rest}>
        <div ref={ref} className={innerClassName} style={innerStyle}>
          {children}
        </div>
      </div>);
});
