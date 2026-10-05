import type { SVGProps } from 'react';

type TextExpanderIconProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
};

/** The rounded T from the supplied Text Expander reference. */
export default function TextExpanderIcon({ size = 16, ...props }: TextExpanderIconProps) {
    return <svg width={size} height={size} viewBox="0 20 224 286" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" {...props}>
      <path d="M20 83V77C20 59 31 49 49 47C89 42 151 42 181 47C202 50 212 61 212 78V83" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M116 49V284M75 284H157" stroke="currentColor" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>;
}
