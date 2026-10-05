import { COMMANDS } from '../commandConfigurations/commands';
import { LOCAL_COMMANDS } from '../commandConfigurations/localCommands';
import { LuSparkles } from 'react-icons/lu';
import { TbSparkles } from 'react-icons/tb';
import { SiPerplexity, SiGoogle } from 'react-icons/si';
import { FaBookmark, FaCalendarAlt, FaLink, FaTerminal } from 'react-icons/fa';
import NotesIcon from '../../icons/notesIcon';
export interface AtCommandItem {
    id: string;
    label: string;
    icon: any;
    color: string;
    keywords: string[];
    category: string;
    favIconUrl?: string;
}
// Map specific icons to commands based on ID or keywords
const getIconForCommand = (id: string, keywords: string[] = []) => {
    const lowerId = String(id || '').toLowerCase();
    if (lowerId === 'gpt' || lowerId === 'chatgpt')
        return LuSparkles;
    if (lowerId === 'claude')
        return TbSparkles;
    if (lowerId === 'gemini')
        return TbSparkles;
    if (lowerId === 'perplexity')
        return SiPerplexity;
    if (lowerId === 'google' || lowerId === 'g')
        return SiGoogle;
    if (lowerId === 'calendar')
        return FaCalendarAlt;
    if (lowerId === 'bookmarks')
        return FaBookmark;
    if (lowerId.includes('note'))
        return NotesIcon;
    if (lowerId.includes('link'))
        return FaLink;
    return FaTerminal;
};
// Map specific colors
const getColorForCommand = (id: string) => {
    const lowerId = String(id || '').toLowerCase();
    if (lowerId === 'gpt')
        return 'text-green-500';
    if (lowerId === 'claude')
        return 'text-orange-500';
    if (lowerId === 'gemini')
        return 'text-blue-400';
    if (lowerId === 'perplexity')
        return 'text-teal-500';
    if (lowerId === 'google')
        return 'text-blue-500';
    if (lowerId === 'calendar')
        return 'text-blue-500';
    if (lowerId === 'bookmarks')
        return 'text-amber-500';
    if (lowerId.includes('note'))
        return 'text-yellow-500';
    if (lowerId.includes('link'))
        return 'text-blue-500';
    return 'text-neutral-500';
};
// Combine and map all commands
export const getAllAtCommands = (): AtCommandItem[] => {
    // Start with remote commands
    const remote = COMMANDS
        .filter(cmd => !['gpt', 'perplexity', 'gemini'].includes(cmd.id))
        .map(cmd => ({
        id: cmd.id,
        label: cmd.label,
        icon: getIconForCommand(cmd.id, cmd.keywords),
        color: getColorForCommand(cmd.id),
        keywords: cmd.keywords || [],
        category: cmd.category === 'browser'
            ? 'Browser'
            : cmd.id === 'ai' || ['gpt', 'claude', 'gemini', 'perplexity'].includes(cmd.id)
                ? 'AI Assistants'
                : 'Tools',
    })).filter(cmd => cmd.category !== 'Browser');
    // Add local commands
    const local = LOCAL_COMMANDS
        .filter(cmd => cmd.id !== 'settings')
        .map(cmd => ({
        id: cmd.id,
        label: cmd.label,
        icon: getIconForCommand(cmd.id, cmd.keywords),
        color: getColorForCommand(cmd.id),
        keywords: cmd.keywords || [],
        category: 'Workspace',
    }));
    return [...remote, ...local];
};
export const AT_COMMANDS = getAllAtCommands();
export const AT_COMMANDS_LIST = AT_COMMANDS;
export const AT_COMMAND_COUNT = AT_COMMANDS.length;
// Get filtered commands based on search query
export const getFilteredAtCommands = (query: string, recentIds: string[] = []): AtCommandItem[] => {
    const allCommands = getAllAtCommands();
    const searchItems = [...allCommands];
    if (!query) {
        // Group everything by category
        const categorized: Record<string, AtCommandItem[]> = {
            Recent: [],
            'AI Assistants': [],
            Organisation: [],
            Tools: [],
            Browser: [],
        };
        // Populate recent first
        recentIds.forEach(id => {
            const match = searchItems.find(item => item.id === id);
            if (match) {
                categorized['Recent'].push({ ...match, category: 'Recent' });
            }
        });
        searchItems.forEach(item => {
            if (categorized[item.category]) {
                categorized[item.category].push(item);
            }
            else {
                categorized['Tools'].push(item);
            }
        });
        return Object.values(categorized).flat();
    }
    // Filter based on query
    const q = query.toLowerCase().trim().replace(/_/g, ' ');
    const filtered = searchItems.filter((cmd: AtCommandItem) => {
        const labelLower = String(cmd.label || '').toLowerCase();
        const idLower = String(cmd.id || '').toLowerCase();
        if (labelLower.startsWith(q))
            return true;
        if (idLower.startsWith(q))
            return true;
        const labelWords = labelLower.split(/\s+/);
        if (labelWords.some(word => word.startsWith(q)))
            return true;
        if (cmd.keywords.some(kw => {
            const kwLower = String(kw || '').toLowerCase();
            return kwLower.startsWith(q) || kwLower.split(/\s+/).some(word => word.startsWith(q));
        })) {
            return true;
        }
        return false;
    });
    // Sort filtered results
    const categoryOrder = ['Recent', 'AI Assistants', 'Workspace', 'Tools'];
    const sorted = filtered.sort((a: AtCommandItem, b: AtCommandItem) => {
        const aIsRecent = recentIds.includes(a.id);
        const bIsRecent = recentIds.includes(b.id);
        if (aIsRecent && !bIsRecent)
            return -1;
        if (!aIsRecent && bIsRecent)
            return 1;
        const aExact = String(a.label || '')
            .toLowerCase()
            .startsWith(q);
        const bExact = String(b.label || '')
            .toLowerCase()
            .startsWith(q);
        if (aExact && !bExact)
            return -1;
        if (!aExact && bExact)
            return 1;
        const aCatIdx = categoryOrder.indexOf(a.category);
        const bCatIdx = categoryOrder.indexOf(b.category);
        return aCatIdx - bCatIdx;
    });
    return sorted;
};
export const getFilteredAtCommandCount = (query: string, recentIds: string[] = []): number => {
    return getFilteredAtCommands(query, recentIds).length;
};
