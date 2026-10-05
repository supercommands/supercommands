/**
 * Entity-neutral view models for popup presentation.
 *
 * Records, commands, history sources, and execution callbacks stay outside the
 * display layer and are adapted into these React-node slots later.
 */
import type React from 'react';
import type { WebsitePopupEntityKind, WebsitePopupTextCommandTargetEntity } from '../../../../shared-components/websitePopup/contracts/websitePopupExecutionTypes';
export type WebsitePopupResultEditTarget = {
    entity: WebsitePopupEntityKind;
    targetId: string;
};
export type WebsitePopupTextCommandEditTarget = {
    entity: WebsitePopupTextCommandTargetEntity;
    targetId: string;
    referenceId: string;
    value: string;
    title: string;
};
export type WebsitePopupPrefixEditTarget = {
    type: 'category' | 'action' | 'subcommand';
    category: string;
    value: string;
    title: string;
};
export type WebsitePopupDisplayIconTone = 'option' | 'action' | 'ai' | 'save' | 'capture' | 'summarize' | 'extract' | 'collection';
export type WebsitePopupDisplayTrailingTone = 'key';
export type WebsitePopupDisplayIconLayout = 'standard' | 'stacked';
export type WebsitePopupDisplayRow = {
    id: string;
    title: React.ReactNode;
    icon?: React.ReactNode;
    iconTone?: WebsitePopupDisplayIconTone;
    iconLayout?: WebsitePopupDisplayIconLayout;
    detail?: React.ReactNode;
    trailing?: React.ReactNode;
    trailingTone?: WebsitePopupDisplayTrailingTone;
    textCommandEdit?: WebsitePopupTextCommandEditTarget;
    prefixEdit?: WebsitePopupPrefixEditTarget;
    resultEdit?: WebsitePopupResultEditTarget;
    selected?: boolean;
    /** Show a leading checkbox for a multi-select result, whether checked or not. */
    checkable?: boolean;
    checked?: boolean;
    disabled?: boolean;
};
export type WebsitePopupDisplaySection = {
    id: string;
    label: string;
    trailing?: React.ReactNode;
    rows: WebsitePopupDisplayRow[];
};
