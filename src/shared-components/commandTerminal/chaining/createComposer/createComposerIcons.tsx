import * as React from 'react';
import { FiCalendar, FiFileText, FiLink, FiPaperclip, FiRepeat, FiStar, FiTag, FiTerminal, FiType, FiZap } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import type { CreateComposerField, CreateComposerProperty } from './CreateComposerTypes';
export const getCreateComposerFieldIcon = (field: CreateComposerField) => {
    if (field.icon)
        return field.icon;
    if (field.key === 'title')
        return <FiType className="h-4 w-4 shrink-0 text-current"/>;
    if (field.key === 'url')
        return <FiLink className="h-4 w-4 shrink-0 text-current"/>;
    return <FiFileText className="h-4 w-4 shrink-0 text-current"/>;
};
export const getCreateComposerPropertyIcon = (property: CreateComposerProperty) => {
    if (property.icon)
        return property.icon;
    if (property.key === 'url')
        return <FiLink className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'time')
        return <FiCalendar className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'recurring')
        return <FiRepeat className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'reference')
        return <FiPaperclip className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'hotkey')
        return <FiZap className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'shortcut')
        return <FiTerminal className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'tag')
        return <FiTag className="h-4 w-4 shrink-0 text-current"/>;
    if (property.key === 'favorite') {
        return property.active
            ? <FaStar className="h-4 w-4 shrink-0 text-current"/>
            : <FiStar className="h-4 w-4 shrink-0 text-current"/>;
    }
    return <FiFileText className="h-4 w-4 shrink-0 text-current"/>;
};
