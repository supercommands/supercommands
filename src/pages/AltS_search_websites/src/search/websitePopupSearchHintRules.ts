/**
 * Central visibility policies for right-side popup search hints.
 *
 * Rules consume semantic interaction state rather than DOM input values, which
 * keeps the behavior reusable across future default/create/save/filter modes.
 */
import type { WebsitePopupInteractionState } from '../interaction/websitePopupInteractionTypes';
import { selectWebsitePopupQuery } from '../interaction/websitePopupInteractionSelectors';
export type WebsitePopupSearchHintVisibilityRule = (state: WebsitePopupInteractionState) => boolean;
/**
 * The slash hint belongs only to the root/default palette. Specialized
 * Create, Save, Filter, and nested submodes have their own active workflow,
 * so showing the root shortcut there is misleading.
 */
export const showWebsitePopupSearchHintWhenQueryEmpty: WebsitePopupSearchHintVisibilityRule = state => state.route.kind === 'default' && selectWebsitePopupQuery(state).length === 0;
