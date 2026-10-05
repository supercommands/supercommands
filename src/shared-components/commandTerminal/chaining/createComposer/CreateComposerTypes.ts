import type * as React from 'react';
export type CreateComposerValidationState = {
    status: 'empty' | 'checking' | 'available' | 'conflict' | 'error';
    value: string;
    message?: string | null;
    conflictId?: string | null;
    canOverwrite?: boolean;
};
export type CreateComposerField = {
    key: string;
    prefix: string;
    label: string;
    value?: string;
    required?: boolean;
    present?: boolean;
    icon?: React.ReactNode;
    iconCategory?: string;
};
export type CreateComposerProperty = {
    key: string;
    prefix?: string;
    label: string;
    icon?: React.ReactNode;
    iconCategory?: string;
    active?: boolean;
    disabled?: boolean;
};
export type CreateComposerFooterAction = {
    label: string;
    variant?: 'default' | 'danger';
    onActivate: () => void;
};
