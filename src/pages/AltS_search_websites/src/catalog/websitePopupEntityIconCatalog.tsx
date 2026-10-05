import TextExpanderIcon from '../../../../shared-components/icons/TextExpanderIcon';
import type React from 'react';
import { BsCalendarCheck } from 'react-icons/bs';
import { FaBookmark, FaLayerGroup, FaLink } from 'react-icons/fa';
import { LuSparkles } from 'react-icons/lu';
import NotesIcon from '../../../../shared-components/icons/notesIcon';
export type WebsitePopupEntityIconKind = 'note' | 'link' | 'snippet' | 'todo' | 'collection' | 'bookmark' | 'prompt' | 'agent';
const ENTITY_ICONS: Record<WebsitePopupEntityIconKind, React.ReactNode> = {
    note: <NotesIcon />,
    link: <FaLink />,
    snippet: <TextExpanderIcon />,
    todo: <BsCalendarCheck />,
    collection: <FaLayerGroup />,
    bookmark: <FaBookmark />,
    prompt: <LuSparkles />,
    agent: <LuSparkles />,
};
export function getWebsitePopupEntityIcon(entity: string): React.ReactNode {
    return ENTITY_ICONS[entity as WebsitePopupEntityIconKind] || <LuSparkles />;
}
