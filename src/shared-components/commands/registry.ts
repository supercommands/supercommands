import { CommandModule, CommandContext, EntitySelection } from './types';
import { ALL_COMMANDS } from './allCommands';
import { normalizePrefix } from './utils';

/**
 * Central registry of all commands
 * Add new commands here to register them
 */
class CommandRegistry {
  private commands: Map<string, CommandModule> = new Map();

constructor() {
    // Register all commands defined in the centralized allCommands file
    ALL_COMMANDS.forEach(command => this.register(command));
  }


  register(command: CommandModule): void {
    if (this.commands.has(command.id)) {
      console.warn(`Command ${command.id} is already registered`);
      return;
    }
    this.commands.set(command.id, command);
  }

  get(id: string): CommandModule | undefined {
    return this.commands.get(id);
  }

  getAll(): CommandModule[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all commands formatted for LOCAL_COMMANDS array (backward compatibility)
   */
  getLocalCommandsDefinitions() {
    return this.getAll().map(cmd => ({
      id: cmd.id,
      label: cmd.label,
      prefix: normalizePrefix(cmd.prefix),
      behavior: cmd.behavior,
      keywords: cmd.keywords,
      scope: cmd.scope,
      action: cmd.action,
      executeId: cmd.id,
      url: cmd.url,
      getDynamicLabel: cmd.getDynamicLabel,
      icon: cmd.icon,
      showInDashboard: cmd.showInDashboard,
      category: cmd.category,
      isAvailable: cmd.isAvailable,
    }));
  }


  /**
   * Get all keywords for search (replaces LOCAL_COMMAND_KEYWORDS)
   */
  getKeywordsMap(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    this.getAll().forEach(cmd => {
      map[cmd.id] = cmd.keywords;
    });
    return map;
  }

  /**
   * Universal executor - handles both instant and entity commands
   */
  async execute(id: string, context: CommandContext, entity?: EntitySelection): Promise<void> {
    const command = this.get(id);
    if (!command) {
      console.warn(`Command ${id} not found`);
      return;
    }

    // Check if command can execute
    if (command.canExecute && !command.canExecute(context, entity)) {
      context.services.toast('Command cannot be executed', 'error');
      return;
    }

    // Pre-execution hook
    if (command.onBeforeExecute) {
      await command.onBeforeExecute(context);
    }

    // Handle URL-based commands
    if (command.url && command.behavior === 'instant') {
      const chromeAny = (window as any)?.chrome;

      // 1. Try direct tabs.create if available (extension context)
      if (chromeAny?.tabs?.create) {
        try {
          chromeAny.tabs.create({ url: command.url });
          return;
        } catch (e) {
          console.warn('[BrowserCommand] chrome.tabs.create failed, trying message:', e);
        }
      }

      // 2. Try sending message to background script (if in context where tabs API is restricted but runtime isn't)
      if (chromeAny?.runtime?.sendMessage) {
        chromeAny.runtime.sendMessage({ action: 'open_tab', url: command.url }, (response: any) => {
          if (chromeAny.runtime.lastError) {
            console.warn('[BrowserCommand] Failed to open tab via background:', chromeAny.runtime.lastError);
            // 3. Fallback to window.open (might be blocked for chrome:// URLs)
            try {
              window.open(command.url, '_blank');
            } catch (err) {
              console.error('[BrowserCommand] window.open failed:', err);
            }
          }
        });
        return;
      }

      // 3. Final fallback
      try {
        window.open(command.url, '_blank');
      } catch (err) {
        console.error('[BrowserCommand] window.open final fallback failed:', err);
      }
      return;
    }

    // Handle urlTemplate-based commands that have no execute() (e.g. browser chrome:// pages)
    if (command.urlTemplate && typeof command.execute !== 'function') {
      const chromeAny = (window as any)?.chrome;
      const needsQuery = command.urlTemplate.includes('{query}');

      if (!needsQuery) {
        // Direct URL — open immediately (e.g. chrome://downloads, chrome://history)
        const url = command.urlTemplate;
        if (chromeAny?.tabs?.create) {
          try { chromeAny.tabs.create({ url }); return; } catch (e) { /* fall through */ }
        }
        if (chromeAny?.runtime?.sendMessage) {
          chromeAny.runtime.sendMessage({ action: 'open_tab', url });
          return;
        }
        window.open(url, '_blank');
        return;
      }

      // Has {query} but no execute — substitute the prompt if available, else fall through
    
    }

    // Execute the command
    if (typeof command.execute === 'function') {
      await command.execute(context, entity);
    } else {
      console.warn(`[CommandRegistry] Command "${id}" has no execute() handler and no url. Nothing to run.`);
    }
  }

  /**
   * Search commands by query
   */
  search(query: string): CommandModule[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(cmd => {
      if (cmd.showInDashboard === false) return false;
      // Match by prefix
      if (normalizePrefix(cmd.prefix).toLowerCase().includes(lowerQuery.replace(/^\/+/, ''))) return true;
      // Match by label
      if (cmd.label.toLowerCase().includes(lowerQuery)) return true;
      // Match by keywords
      if (cmd.keywords.some(kw => kw.toLowerCase().includes(lowerQuery))) return true;
      // Match by ID
      if (cmd.id.includes(lowerQuery)) return true;
      return false;
    });
  }
}

// Singleton instance
export const commandRegistry = new CommandRegistry();

// Export convenience functions
export const getAllCommands = () => commandRegistry.getAll();
export const getCommand = (id: string) => commandRegistry.get(id);
export const getLocalCommandDefinitions = () => commandRegistry.getLocalCommandsDefinitions();
export const executeCommand = (id: string, context: CommandContext, entity?: EntitySelection) =>
  commandRegistry.execute(id, context, entity);
export const searchCommands = (query: string) => commandRegistry.search(query);
