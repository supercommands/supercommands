import { useState, useRef, useEffect, useCallback } from 'react';
import type React from 'react';
import { useUIStore } from '../../../shared-components/uiStateManager';
import type { Attachment, AnyCommandId, FooterStatus } from '../utilityFunctions/types';

interface UseAttachmentStateProps {
  lockedCommand: AnyCommandId | null;
  triggerNotification: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setValue: (val: string) => void;
  inputRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;


  isLinkEditModalOpen: boolean;
  setFooterStatus: (status: FooterStatus) => void;
}

export function useAttachmentState({
  lockedCommand,
  triggerNotification,
  setValue,
  inputRef,
  containerRef,


  isLinkEditModalOpen,
  setFooterStatus,
}: UseAttachmentStateProps) {
  const [selectedImages, setSelectedImages] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedImagesRef = useRef<typeof selectedImages>([]);
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = useRef(0);

  const activeView = useUIStore(s => s.activeView);
  const activeEditor = useUIStore(s => s.activeEditor);

  useEffect(() => {
    selectedImagesRef.current = selectedImages;
  }, [selectedImages]);

  // Revoke Blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      selectedImagesRef.current.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, []);

  const processFiles = useCallback(
    (files: FileList | File[]) => {
      if (!files || files.length === 0) return;

      const currentCount = selectedImagesRef.current.length;
      let addedInThisBatch = 0;
      let limitExceeded = false;
      let unsupportedTypeInBatch = false;

      const isAiCommand =
        lockedCommand === 'gpt' ||
        lockedCommand === 'claude' ||
        lockedCommand === 'perplexity' ||
        lockedCommand === 'gemini' ||
        lockedCommand === 'ai' ||
        lockedCommand === 'upload_drive';

      const allowedAIExtensions = new Set([
        'pdf',
        'doc',
        'docx',
        'txt',
        'md',
        'csv',
        'xlsx',
        'xls',
        'json',
        'ppt',
        'pptx',
        'py',
        'js',
        'ts',
        'tsx',
        'css',
        'html',
        'java',
        'c',
        'cpp',
        'h',
        'sql',
        'sh',
        'rtf',
        'odt',
        'epub',
      ]);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isImage = file.type.startsWith('image/');
        const extension = file.name.split('.').pop()?.toLowerCase() || '';

        // Allow ALL files for AI commands (User Request: "All types of files")
        // Also allow them when no command is locked so user can see AI suggestions
        const isAllowedDoc = isAiCommand || !lockedCommand;
        const isValidType = isImage || isAllowedDoc;

        if (!isValidType) {
          unsupportedTypeInBatch = true;
          continue;
        }

        if (currentCount + addedInThisBatch >= 8) {
          limitExceeded = true;
          break;
        }

        addedInThisBatch++;
        const blobUrl = URL.createObjectURL(file);

        setSelectedImages(prev => {
          if (prev.length >= 8) {
            URL.revokeObjectURL(blobUrl);
            return prev;
          }

          return [
            ...prev,
            {
              url: blobUrl,
              file: file,
              mimeType: file.type || (isAllowedDoc ? 'application/octet-stream' : 'image/png'),
              filename: file.name,
            },
          ];
        });
      }

      if (unsupportedTypeInBatch) {
        if (!isAiCommand) {
          triggerNotification('File support is limited to images here. AI commands support more formats.', 'info');
        } else {
          triggerNotification('Some files were skipped. Only images and supported documents are allowed.', 'info');
        }
      }

      if (limitExceeded) {
        triggerNotification('Maximum 8 files allowed', 'error');
        setFooterStatus({
          message: 'Maximum 8 files allowed',
          type: 'error',
        });
        setTimeout(() => setFooterStatus(null), 3000);
      }
    },
    [lockedCommand, triggerNotification, setFooterStatus],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        processFiles(event.target.files);
      }
      // Reset input value so the same file can be selected again if needed
      event.target.value = '';
    },
    [processFiles],
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const clipboardData = event.clipboardData;
      if (!clipboardData) return;

      // Try getting files from .files first (more robust for multiple filesystem files)
      const clipboardFiles = clipboardData.files;
      let files: File[] = [];

      if (clipboardFiles && clipboardFiles.length > 0) {
        files = Array.from(clipboardFiles);
      } else if (clipboardData.items) {
        // Fallback to .items
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }

      if (files.length > 0) {
        // Prevent default paste if files are detected
        event.preventDefault();
        // Mark native event as processed to avoid double-trigger in global handlers
        if (event.nativeEvent) (event.nativeEvent as any)._processed = true;
        processFiles(files);
      }
    },
    [processFiles],
  );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set to false if we're actually leaving the container, not just entering a child
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent | DragEvent) => {
      event.preventDefault();
      event.stopPropagation();

      // Mark the native event as processed to avoid double-trigger in global handlers
      const nativeEvent = (event as any).nativeEvent || event;
      if (nativeEvent) (nativeEvent as any)._processed = true;

      setIsDragging(false);

      const dataTransfer = (event as any).dataTransfer;
      if (!dataTransfer) return;

      // 1. Handle Files
      if (dataTransfer.files && dataTransfer.files.length > 0) {
        processFiles(dataTransfer.files);
        return;
      }

      // 2. Handle Text/URLs
      const url = dataTransfer.getData('URL');
      const text = dataTransfer.getData('text/plain');

      if (url) {
        setValue(url);
        if (lockedCommand !== 'ai') {
          inputRef.current?.focus();
        }
        return;
      }

      if (text) {
        setValue(text);
        if (lockedCommand !== 'ai') {
          inputRef.current?.focus();
        }
        return;
      }
    },
    [processFiles, setValue, lockedCommand, inputRef],
  );

  // Global attachment handlers (Paste & Drag/Drop)
  useEffect(() => {
    const isRestrictedView =
      activeEditor?.type === 'note' ||
      (activeEditor?.type as string) === 'prompt' ||
      activeView?.type === 'createWorkspace' ||
      activeView?.type === 'sharedFolderCreation' ||
      activeView?.type === 'workspaceShare';

    const isCreatingNewItem = activeEditor?.id === 'new';
    const isRestrictedMode = isCreatingNewItem || isLinkEditModalOpen;

    if (isRestrictedView || isRestrictedMode) return;

    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Skip if focusing another input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.getAttribute('contenteditable') === 'true';

      if (isInput) return;

      // Also skip if it bubbled up from our own search bar
      if ((e as any)._processed || e.defaultPrevented || e.composedPath().some(el => el === containerRef.current))
        return;

      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      // Use .files for better compatibility with filesystem file pastes
      let files: File[] = [];
      const clipboardFiles = clipboardData.files;

      if (clipboardFiles && clipboardFiles.length > 0) {
        files = Array.from(clipboardFiles);
      } else if (clipboardData.items) {
        // Fallback to items loop
        for (let i = 0; i < clipboardData.items.length; i++) {
          const item = clipboardData.items[i];
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        processFiles(files);
        if (lockedCommand !== 'ai') {
          inputRef.current?.focus();
        }
      }
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleGlobalDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsGlobalDragging(true);
      }
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsGlobalDragging(false);
      }
    };

    const handleGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsGlobalDragging(false);
      dragCounter.current = 0;

      // Skip if already handled by local handlers
      if ((e as any)._processed || e.defaultPrevented || e.composedPath().some(el => el === containerRef.current))
        return;

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        processFiles(Array.from(files));
        if (lockedCommand !== 'ai') {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('dragenter', handleGlobalDragEnter);
    window.addEventListener('dragleave', handleGlobalDragLeave);
    window.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('dragenter', handleGlobalDragEnter);
      window.removeEventListener('dragleave', handleGlobalDragLeave);
      window.removeEventListener('drop', handleGlobalDrop);
    };
  }, [activeView, activeEditor, isLinkEditModalOpen, processFiles, inputRef, containerRef, lockedCommand]);

  // Global Drag & Drop Listeners (Functionality + Global Highlight)
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      handleDrop(e);
    };

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleDrop]);

  const removeSelectedImage = useCallback((index: number) => {
    setSelectedImages(prev => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearSelectedImages = useCallback(() => {
    selectedImagesRef.current.forEach(img => URL.revokeObjectURL(img.url));
    setSelectedImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  return {
    selectedImages,
    setSelectedImages,
    selectedImagesRef,
    fileInputRef,
    hoveredFileIndex,
    setHoveredFileIndex,
    isDragging,
    setIsDragging,
    isGlobalDragging,
    handleFileSelect,
    handlePaste,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    removeSelectedImage,
    clearSelectedImages,
  };
}
