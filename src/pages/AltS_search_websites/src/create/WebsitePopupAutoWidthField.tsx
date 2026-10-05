/**
 * Uses the browser's content-sized field behavior so Create inputs begin
 * compact and grow horizontally within centralized popup width tokens. Picker
 * fields may also retain their committed-label width while filtering.
 */
import { forwardRef, type InputHTMLAttributes } from 'react';
export type WebsitePopupAutoWidthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value'> & {
    value: string;
    /** Keeps a picker wide enough for its committed label while its query is empty. */
    stableValue?: string;
};
export const WebsitePopupAutoWidthField = forwardRef<HTMLInputElement, WebsitePopupAutoWidthFieldProps>(function WebsitePopupAutoWidthField({ value, stableValue, className, placeholder, ...inputProps }, ref) {
    return (<span className={[
            'website-popup-auto-width-field',
            stableValue !== undefined ? 'website-popup-auto-width-field--stable' : ''
        ].filter(Boolean).join(' ')}>
      {stableValue !== undefined ? (<>
          <span className="website-popup-auto-width-field__sizer" aria-hidden="true">
            {value || placeholder || '\u00a0'}
          </span>
          <span className="website-popup-auto-width-field__sizer" aria-hidden="true">
            {stableValue || '\u00a0'}
          </span>
        </>) : null}
      <input {...inputProps} ref={ref} className={['website-popup-auto-width-field__input', className].filter(Boolean).join(' ')} value={value} placeholder={placeholder}/>
    </span>);
});
