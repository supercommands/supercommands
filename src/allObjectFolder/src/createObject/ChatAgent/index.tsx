/**
 * @file index.tsx
 * @description The main ChatAgent React component. Implements tabs to navigate
 * between saved chat Agents, Automations, and Skills. Manages log presentation,
 * inline agent renaming, and destination picking.
 * 
 * @usage
 * ```tsx
 * import ChatAgent from './ChatAgent';
 * <ChatAgent state={searchState} />
 * ```
 */

import type * as React from 'react';

import { useAppearance } from '@extension/ui';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { SuggestionState } from '../../../../shared-components/searchBarMain/userInterfaceComponents/searchBar';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaCheck,
  FaTimes,
  FaPencilAlt,
  FaFolder,
} from 'react-icons/fa';
import { LuSave } from 'react-icons/lu';
import { DestinationPicker } from '../../../../shared-components/editorToolbar/DestinationPicker';
import { SharedPropertiesToolbar } from '../../../../shared-components/editorToolbar/SharedPropertiesToolbar';

import useNotification from '../../../../shared-components/notifications/useNotification';
import MyAutomationsList from '../automationBeta/searchIntegration/myAutomationsList';
import AutomationCapabilitiesMenu from '../automationBeta/searchIntegration/automationCapabilitiesMenu';
import { AutomationSaveNotification } from '../automationBeta/searchIntegration/automationSaveNotification';

import { useUIStore } from '../../../../shared-components/uiStateManager';
import { generateEntityId } from '../../../../shared-components/utils/idGenerator';
const DoubleTick = ({ size = 14 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
    {/* First Tick (Left) */}
    <FaCheck size={size} className="absolute left-[-2px] opacity-80" />
    {/* Second Tick (Right/Top) */}
    <FaCheck size={size} className="absolute left-[2px]" />
  </div>
);

import { RenderLogPrompt } from './components/RenderLogPrompt';
import { useChatLogs } from './hooks/useChatLogs';
import { useChatAgentEditor } from './useChatAgentEditor';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllChatAgents, updateChatAgent } from './chatAgentData';

type TabType = 'agents' | 'automations' | 'skills';

interface ChatAgentProps {
  state: SuggestionState;
  initialTab?: TabType;
  savedAutomations?: any[];
  onSelectSavedAgent?: (agent: any) => void;
  onRunAutomation?: (automation: any) => void;
  onEditAutomation?: (automation: any) => void;
  onExecuteModule?: (module: any) => void;
  onClose?: () => void;
  isMac?: boolean;
  onQueryChange?: (val: string) => void;
  isLoggedIn?: boolean;
}

const ChatAgent: React.FC<ChatAgentProps> = ({
  state,
  initialTab = 'agents',
  savedAutomations = [],
  onSelectSavedAgent,
  onRunAutomation,
  onEditAutomation,
  onExecuteModule,
  onClose,
  isMac = false,
  onQueryChange: onQueryChangeProp,
  isLoggedIn = false,
}) => {
  const {
    activeAiSession,
    onQueryChange: onQueryChangeState,
    updateActiveSessionMetadata,
  } = state;

  const onQueryChange = onQueryChangeProp || onQueryChangeState;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { theme } = useAppearance();
  const isDark = theme.isDark;
  const triggerNotification = useNotification();

  const [activeTab, setActiveTab] = useState<TabType>(initialTab as TabType);
  const isAgentTab = activeTab === 'agents';

  // --- Inline Agent Renaming State ---
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [editingAgentName, setEditingAgentName] = useState<string>('');

  // --- New ChatAgent Hook ---
  const activeSessionId = activeAiSession?.id && !String(activeAiSession.id).startsWith('session-') && activeAiSession.id !== 'new-chat' ? String(activeAiSession.id) : null;
  const selectedAIs = state?.selectedAIs || [];
  const initialUrls = useMemo(() => {
    const customModels = activeAiSession?.customModelDefinitions || [];
    const allAiUrls: string[] = [];

    const defaultUrls: Record<string, string> = {
      ai: 'https://chatgpt.com', // fallback
      gpt: 'https://chatgpt.com',
      claude: 'https://claude.ai',
      perplexity: 'https://perplexity.ai',
      gemini: 'https://gemini.google.com',
    };

    selectedAIs.forEach((id: string) => {
      const sessionIdx = activeAiSession?.models?.indexOf(id);
      let baseUrl = '';

      if (sessionIdx !== undefined && sessionIdx !== -1 && activeAiSession?.urls?.[sessionIdx]) {
        baseUrl = activeAiSession.urls[sessionIdx];
      } else if (defaultUrls[id]) {
        baseUrl = defaultUrls[id];
      } else {
        const custom = customModels.find((m: any) => m.id === id);
        if (custom) baseUrl = custom.url;
      }

      if (baseUrl) {
        allAiUrls.push(baseUrl);
      }
    });

    return allAiUrls;
  }, [activeAiSession, selectedAIs]);
  
  const {
    agentTitle,
    setAgentTitle,
    handleSave,
    isDirty
  } = useChatAgentEditor({
    agentId: activeSessionId,
    initialName: activeAiSession?.name || activeAiSession?.prompt || 'Untitled Agent',
    initialUrls,
  });

  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLocationPickerOpen, setIsLocationPickerOpen] = useState(false);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | null>(null);
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null);
  const [targetTagIds, setTargetTagIds] = useState<string[]>([]);
  
  // Keep track of our local chats
  const myChats = useLiveQuery(() => getAllChatAgents()) || [];

  const activeSavedAgent = useMemo(() => {
    if (!activeAiSession) return null;
    return myChats.find(a => String(a.id) === String(activeAiSession.id)) || null;
  }, [activeAiSession, myChats]);

  const openSaveModal = useCallback(() => {
    setTargetWorkspaceId(activeSavedAgent?.workspaceId || null);
    setTargetFolderId(activeSavedAgent?.folderId || null);
    setTargetTagIds(activeSavedAgent?.tagIds || []);
    setIsSaveModalOpen(true);
  }, [activeSavedAgent]);

  const handleManualSave = async () => {
    const savedId = await handleSave(targetWorkspaceId || undefined, targetFolderId, targetTagIds);
    if (savedId) {
      triggerNotification('Agent saved successfully!', 'success');
      updateActiveSessionMetadata?.({ id: savedId, name: agentTitle });
      setIsSaveModalOpen(false);
    } else {
      triggerNotification('Failed to save agent.', 'error');
    }
  };

  const { logs, prevLogsLengthRef } = useChatLogs(activeAiSession?.sessionKey, activeAiSession?.prompt);

  const [showSaveToast, setShowSaveToast] = useState(false);
  const hasShownSaveToastForSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (logs.length > prevLogsLengthRef.current) {
      if (activeAiSession && !activeSavedAgent) {
        const sessionId = String((activeAiSession as any).id || activeAiSession.sessionKey);
        if (hasShownSaveToastForSessionIdRef.current !== sessionId) {
          setShowSaveToast(true);
          hasShownSaveToastForSessionIdRef.current = sessionId;
          setTimeout(() => {
            setShowSaveToast(false);
          }, 8000);
        }
      }
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs.length, activeAiSession, activeSavedAgent]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    setActiveTab(initialTab as TabType);
  }, [initialTab]);



  const handleCloseWithCheck = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      handleCloseWithCheck();
      return true; // We handled it
    });
    return unregister;
  }, [handleCloseWithCheck]);

  useEffect(() => {
    if (!editingAgentId) return;
    const unregister = useUIStore.getState().registerEscapeInterceptor(() => {
      setEditingAgentId(null);
      return true;
    });
    return unregister;
  }, [editingAgentId]);

  const handleAgentClick = (agentRecord: any) => {
    // Transform our ChatAgentRecord into the shape Searchbar expects
    const allAiUrls: Record<string, string> = {};
    (agentRecord.urls || []).forEach((url: string) => {
       let modelId = 'unknown';
       if (url.includes('chatgpt.com')) modelId = 'gpt';
       else if (url.includes('claude.ai')) modelId = 'claude';
       else if (url.includes('gemini.google')) modelId = 'gemini';
       else if (url.includes('perplexity.ai')) modelId = 'perplexity';
       else modelId = generateEntityId('customModel');
       
       allAiUrls[modelId] = url;
    });

    const syntheticAgent = {
       id: agentRecord.id,
       name: agentRecord.title,
       workspace_id: agentRecord.workspaceId,
       folder_id: agentRecord.folderId,
       automation_steps: [{
          config: {
             allAiUrls: allAiUrls
          }
       }]
    };
    
    onSelectSavedAgent?.(syntheticAgent);
  };


  return (
    <div
      className={`flex h-full w-full relative rounded-b-xl border-t-0 ${logs.length > 0 ? `glass-card border-white/40 dark:border-white/10 dark:bg-transparent ${isDark ? 'border border-white/10' : 'border border-neutral-200'}` : 'border-transparent bg-transparent'} ${isDark ? '' : 'bg-transparent'}`}
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      }}>
      <AnimatePresence>
        {(myChats.length > 0 || logs.length > 0) && (
          <motion.div
            initial={{ width: 0, opacity: 0, x: 20 }}
            animate={{ width: 190, opacity: 1, x: 0 }}
            exit={{ width: 0, opacity: 0, x: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-[10vh] h-[80vh] z-[99999] rounded-l-xl border shadow-2xl overflow-hidden ${isDark
                ? `border-white/10 ${isAgentTab ? 'bg-black/40 backdrop-blur-md' : 'bg-black'}`
                : 'border-[#eee8d5] bg-[#fdf6e3]'
              }`}>
            <div className="flex-1 overflow-y-auto px-1.5 pb-2 custom-scrollbar no-scrollbar scrollbar-hide">
              <div className="mb-1 px-1 pt-3">
                <h4
                  className={`text-[11px] font-black tracking-[0.2em] mb-2 ${isDark ? 'text-white/30' : 'text-[#586e75]'
                    }`}>
                  Your Chats :
                </h4>
              </div>

              <div className="mb-4">
                <div className="space-y-0.2">
                  {(() => {
                    

                    const activeUnsaved =
                      activeAiSession && !activeSavedAgent
                        ? [
                          {
                            id: 'active-session',
                            name: activeAiSession.name || activeAiSession.prompt || 'Untitled Session',
                            isActive: true,
                          },
                        ]
                        : [];

                    const savedPart = myChats.map(a => ({
                      ...a,
                      name: a.title, // alias title to name for the UI
                      isActive: activeSavedAgent ? String(a.id) === String(activeSavedAgent.id) : false,
                    }));
                    const activeSaved = savedPart.filter(a => a.isActive);
                    const otherSaved = savedPart.filter(a => !a.isActive);

                    const allItems = [...activeUnsaved, ...activeSaved, ...otherSaved];

                    return allItems.length > 0
                      ? allItems.map((agent: any) => {
                        const isEditing = editingAgentId === String(agent.id);

                        const handleSaveName = async () => {
                          if (!editingAgentName.trim()) {
                            setEditingAgentId(null);
                            return;
                          }
                          try {
                            if (agent.id !== 'active-session') {
                              await updateChatAgent(String(agent.id), { title: editingAgentName.trim() });
                            }

                            // Always update the active session metadata so the header reflects the new name
                            updateActiveSessionMetadata?.({ name: editingAgentName.trim() });

                            // If this was an active session, we should also update its name in the local storage if it exists
                            const sessionKey = activeAiSession?.sessionKey;
                            if (sessionKey) {
                              chrome.storage.local.get([sessionKey], result => {
                                const sessionData = result[sessionKey];
                                if (sessionData) {
                                  sessionData.name = editingAgentName.trim();
                                  chrome.storage.local.set({ [sessionKey]: sessionData });
                                }
                              });
                            }
                          } catch (err) {
                            console.error('Failed to update agent name:', err);
                          } finally {
                            setEditingAgentId(null);
                          }
                        };

                        return (
                          <div
                            key={agent.id}
                            className={`w-full flex items-center justify-between px-1.5 py-1 transition-all group ${agent.isActive
                                ? isDark
                                  ? 'bg-white/10'
                                  : 'bg-[#eee8d5]'
                                : isDark
                                  ? 'hover:bg-white/5'
                                  : 'hover:bg-[#eee8d5]/70'
                              }`}>
                            <div
                              className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer"
                              onClick={() => {
                                setActiveTab('agents');
                                if (agent.id !== 'active-session') {
                                  handleAgentClick(agent);
                                }
                              }}
                              onDoubleClick={() => {
                                setEditingAgentId(String(agent.id));
                                setEditingAgentName(agent.name);
                              }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editingAgentName}
                                  onChange={e => setEditingAgentName(e.target.value)}
                                  onBlur={handleSaveName}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveName();
                                  }}
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                  className={`text-[12px] w-full px-1 py-0.5 rounded border outline-none bg-transparent ${isDark
                                      ? 'border-white/20 text-white bg-neutral-800'
                                      : 'border-neutral-300 text-[#073642] bg-white'
                                    }`}
                                />
                              ) : (
                                <span
                                  className={`text-[12px] truncate ${agent.isActive
                                      ? isDark
                                        ? 'text-white font-bold'
                                        : 'text-[#073642] font-bold'
                                      : isDark
                                        ? 'text-white/60 group-hover:text-white'
                                        : 'text-[#657b83] group-hover:text-[#073642]'
                                    }`}>
                                  {agent.name}
                                </span>
                              )}
                            </div>

                            {!isEditing && (
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingAgentId(String(agent.id));
                                  setEditingAgentName(agent.name);
                                }}
                                className={`opacity-0 group-hover:opacity-60 hover:opacity-100 p-1 rounded transition-opacity ${isDark
                                    ? 'text-white/60 hover:text-white'
                                    : 'text-[#657b83] hover:text-[#073642]'
                                  }`}>
                                <FaPencilAlt size={9} />
                              </button>
                            )}
                          </div>
                        );
                      })
                      : null;
                  })()}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAgentTab ? (
        <div
          className={`flex-1 flex flex-col min-w-0 relative min-h-0 ${logs.length > 0 ? (isDark ? 'bg-neutral-900/5' : 'bg-[#fdf6e3]') : 'bg-transparent'}`}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <div className="flex flex-col gap-3 min-h-full">
              <AnimatePresence initial={false}>
                {logs.map(log => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-end self-end max-w-[95%] py-1">
                    <div
                      className={`text-[13px] leading-snug text-right ${isDark ? 'text-white' : 'text-[#073642]'}`}>
                      <RenderLogPrompt prompt={log.prompt} isDark={isDark} />
                    </div>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5 opacity-40">
                      <span className={`text-[10px] font-medium ${isDark ? 'text-white/60' : 'text-[#586e75]'}`}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`flex items-center ${isDark ? 'text-white/40' : 'text-[#93a1a1]'}`}>
                        <DoubleTick size={14} />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className={`relative flex flex-1 min-w-0 flex-col ${isDark ? 'bg-black' : 'bg-[#fdf6e3]'}`}>
          <button
            onClick={onClose}
            className="absolute top-2 right-2 z-[90] p-1.5 rounded-full hover:bg-white/10 text-neutral-500 hover:text-neutral-300 transition-all active:scale-95 group focus:outline-none"
            title="Exit AI Mode">
            <FaTimes
              size={16}
              className="transition-transform group-hover:rotate-90 opacity-70 group-hover:opacity-100"
            />
          </button>
          <div className="flex-1 min-h-0 pt-2">
            {activeTab === 'automations' ? (
              <MyAutomationsList
                automations={savedAutomations}
                onRunAutomation={onRunAutomation}
                onEditAutomation={onEditAutomation}
              />
            ) : (
              <AutomationCapabilitiesMenu onExecuteModule={onExecuteModule} />
            )}
          </div>
        </div>
      )}
      {isLoggedIn && isAgentTab && activeAiSession && (
        <div className={`absolute bottom-4 right-4 z-[50] flex flex-col items-end gap-2`}>
          {isSaveModalOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`w-80 rounded-xl p-4 shadow-2xl border ${isDark ? 'bg-black border-white/20' : 'bg-[#fdf6e3] border-[#d8d2bf]'}`}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-[#073642]'}`}>Save Chat Agent</h3>
                <button onClick={() => setIsSaveModalOpen(false)} className="opacity-50 hover:opacity-100"><FaTimes size={12}/></button>
              </div>
              <input 
                type="text" 
                value={agentTitle} 
                onChange={(e) => setAgentTitle(e.target.value)} 
                className={`w-full mb-3 rounded px-3 py-2 text-xs border ${isDark ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-[#d8d2bf]'}`}
                placeholder="Agent Name"
              />
              <div className="relative mb-4 overflow-visible">
                <SharedPropertiesToolbar
                  initialSnippet={{ workspaceId: targetWorkspaceId, folderId: targetFolderId, tagIds: targetTagIds, category: 'chatAgent' }}
                  compoundId={activeSessionId || 'new'}
                  defaultName={agentTitle}
                  showShortcut={false}
                  showTodo={false}
                  onChange={(props: any) => {
                    if (props.workspaceId !== undefined) setTargetWorkspaceId(props.workspaceId);
                    if (props.folderId !== undefined) setTargetFolderId(props.folderId);
                    if (props.selectedTags !== undefined) setTargetTagIds(props.selectedTags.map((t: any) => t.id));
                  }}
                  layout="horizontal"
                  openPopupsToBottom={true}
                />
              </div>
              <div className="flex justify-end">
                <button onClick={handleManualSave} className={`px-4 py-1.5 rounded text-xs font-bold ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#eee8d5] text-[#073642] hover:bg-[#d8d2bf]'}`}>
                  Confirm Save
                </button>
              </div>
            </motion.div>
          ) : (
            isDirty ? (
              <button
                onClick={openSaveModal}
                className={`flex items-center justify-center gap-2 rounded-md border w-auto px-3 py-2 text-[11px] font-bold transition-all shadow-lg active:scale-95 ${isDark
                    ? 'border-white/20 bg-neutral-800 text-white/90 hover:bg-neutral-700 hover:text-white'
                    : 'border-[#d8d2bf] bg-[#eee8d5] text-[#073642] hover:bg-[#e7e0cc]'
                  }`}>
                <LuSave size={12} />
                <span>{activeSavedAgent ? 'Update Agent' : 'Save Agent'}</span>
              </button>
            ) : (
              <div
                className={`flex items-center justify-center gap-1.5 rounded-md border w-auto px-3 py-1.5 text-[10px] font-semibold cursor-default shadow-lg ${isDark
                    ? 'border-white/10 bg-neutral-800/50 text-white/50'
                    : 'border-[#d8d2bf] bg-[#eee8d5]/70 text-[#586e75]'
                  }`}>
                <FaCheck size={10} />
                <span>Agent Saved</span>
              </div>
            )
          )}
          {showSaveToast && (
            <div className="relative">
              <AutomationSaveNotification 
                onClose={() => setShowSaveToast(false)} 
                onSave={() => { openSaveModal(); setShowSaveToast(false); }}
                isDarkMode={isDark}
                isMac={isMac}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatAgent;
