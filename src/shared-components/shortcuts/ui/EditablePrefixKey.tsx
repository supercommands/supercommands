import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { CustomSearchPrefixesForOmniboxStorage, type CustomOmniboxPrefixes } from '../../../storage/localStorage/customSearchPrefixesForOmniboxStorage';

const showToast = (message: string, isError = false) => {
  const container = (window as any).__ALTS_PORTAL_HOST__ || (window as any).__ALTQ_PORTAL_HOST__ || document.body;
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${isError ? 'rgba(239, 68, 68, 0.95)' : 'rgba(0, 0, 0, 0.85)'};
    color: #fff;
    padding: 10px 20px;
    border-radius: 10px;
    font-weight: 600;
    font-size: 12px;
    z-index: 2147483647;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
    pointer-events: none;
    transition: opacity 0.2s ease-in-out;
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
};

export const EditablePrefixKey = ({
  category,
  currentValue,
}: {
  category: keyof CustomOmniboxPrefixes;
  currentValue: string;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentValue);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(currentValue);
  }, [currentValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (editValue === currentValue || !editValue.trim()) {
      setEditValue(currentValue);
      setIsEditing(false);
      return;
    }
    
    setIsSaving(true);
    try {
      const prefixes = await CustomSearchPrefixesForOmniboxStorage.getPrefixes();
      const updated = { ...prefixes, [category]: editValue.trim().toLowerCase() };
      await CustomSearchPrefixesForOmniboxStorage.setPrefixes(updated);
      
      // Notify other components
      window.dispatchEvent(new Event('omniboxPrefixesChanged'));
      setIsEditing(false);
      showToast('Shortcut updated successfully!');
    } catch (error: any) {
      showToast(error.message || 'Failed to save prefix', true);
      setEditValue(currentValue);
      // We keep isEditing true so user can fix it
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      setEditValue(currentValue);
      setIsEditing(false);
    }
  };

  return (
    <div 
      className={clsx(
        "flex items-center justify-center gap-1 px-1.5 py-0 rounded border border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer",
        !isEditing && "opacity-0 group-hover/sidebar:opacity-100 focus-within:opacity-100",
        isEditing && "ring-1 ring-blue-500 border-transparent opacity-100"
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (!isEditing) setIsEditing(true);
      }}
      title="Click to edit prefix"
    >
      {/* Fixed global prefix */}
      {category !== 'command' && (
        <span className="text-[13px] font-light font-mono text-[var(--color-textSecondary)] lowercase pointer-events-none select-none opacity-70">
          C
        </span>
      )}
      
      {/* Editable custom prefix */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          maxLength={2}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className={clsx(
            "text-[13px] font-light font-mono text-[var(--color-textPrimary)] bg-transparent outline-none lowercase p-0 m-0 text-center opacity-70",
            isSaving && "opacity-50"
          )}
          style={{ width: `${Math.max(1, editValue.length)}ch` }}
        />
      ) : (
        <span className="text-[13px] font-light font-mono text-[var(--color-textPrimary)] lowercase select-none opacity-70">
          {currentValue}
        </span>
      )}
    </div>
  );
};
