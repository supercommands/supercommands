import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaFileAlt,
  FaFilePdf,
  FaFileCode,
  FaFileArchive,
  FaFileWord,
  FaFileExcel,
  FaFileAudio,
  FaFileVideo,
  FaTimes,
} from 'react-icons/fa';
import type { Attachment } from '../../utilityFunctions/types';
import { formatFileSize } from '../../utilityFunctions/fileHelpers';

interface AttachmentManagerProps {
  selectedImages: Attachment[];
  removeSelectedImage: (index: number) => void;
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  selectedImages,
  removeSelectedImage,
}) => {
  const [hoveredFileIndex, setHoveredFileIndex] = useState<number | null>(null);

  if (selectedImages.length === 0) return null;

  return (
    <>
      {/* Images Preview (Thumbnails) */}
      <div
        className={`items-center pointer-events-auto z-20 ${
          selectedImages.length > 2 ? 'grid grid-rows-2 grid-flow-col gap-0.5' : 'flex gap-1'
        }`}
      >
        {selectedImages.map((img, idx) => {
          const isSingle = selectedImages.length === 1;
          const sizeClasses = isSingle ? 'w-8 h-8' : 'w-5 h-5';
          const iconSize = isSingle ? 16 : 10;
          const textSize = isSingle ? 'text-[6px]' : 'text-[4px]';

          return (
            <div
              key={idx}
              className="relative group"
              onMouseEnter={() => setHoveredFileIndex(idx)}
              onMouseLeave={() => setHoveredFileIndex(null)}
            >
              <div
                className={`${sizeClasses} rounded-md bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden`}
              >
                {img.mimeType.startsWith('image/') ? (
                  <img
                    src={img.url}
                    alt={`Attachment ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 w-full h-full">
                    {(() => {
                      const ext = img.filename.split('.').pop()?.toLowerCase() || '';
                      if (ext === 'pdf' || img.mimeType === 'application/pdf')
                        return <FaFilePdf size={iconSize} className="text-red-500 mb-0.5" />;
                      if (['xls', 'xlsx', 'csv'].includes(ext))
                        return <FaFileExcel size={iconSize} className="text-green-600 mb-0.5" />;
                      if (['doc', 'docx'].includes(ext))
                        return <FaFileWord size={iconSize} className="text-blue-600 mb-0.5" />;
                      if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
                        return <FaFileArchive size={iconSize} className="text-orange-500 mb-0.5" />;
                      if (
                        [
                          'js',
                          'ts',
                          'tsx',
                          'py',
                          'java',
                          'c',
                          'cpp',
                          'html',
                          'css',
                          'json',
                          'sh',
                          'sql',
                        ].includes(ext)
                      )
                        return (
                          <FaFileCode size={iconSize} className="text-yellow-500 dark:text-yellow-400 mb-0.5" />
                        );
                      if (['mp3', 'wav', 'ogg'].includes(ext))
                        return <FaFileAudio size={iconSize} className="text-purple-500 mb-0.5" />;
                      if (['mp4', 'mov', 'avi', 'mkv'].includes(ext))
                        return <FaFileVideo size={iconSize} className="text-pink-500 mb-0.5" />;
                      return <FaFileAlt size={iconSize} className="text-[var(--color-iconDefault)] mb-0.5" />;
                    })()}
                    {!isSingle ? null : (
                      <span
                        className={`${textSize} text-neutral-500 font-bold truncate w-full px-0.5 text-center leading-none`}
                      >
                        {img.filename.split('.').pop()?.toUpperCase().slice(0, 4) || 'FILE'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  removeSelectedImage(idx);
                }}
                className="absolute -top-1.5 -left-1 bg-white dark:bg-neutral-700 rounded-full p-0.5 shadow-sm border border-neutral-200 dark:border-neutral-600 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all"
                title="Remove attachment"
              >
                <FaTimes size={8} className="text-[var(--color-iconDefault)] hover:text-red-500" />
              </button>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {hoveredFileIndex !== null && selectedImages[hoveredFileIndex] && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10, x: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed pointer-events-none"
            style={{
              zIndex: 999999,
              right: '24px',
              top: '120px',
            }}
          >
            <div className="bg-white/90 dark:bg-neutral-900/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 dark:border-white/10 p-5 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/5">
              {selectedImages[hoveredFileIndex].mimeType.startsWith('image/') ? (
                <div className="flex flex-col gap-3">
                  <div className="relative overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-900 shadow-inner">
                    <img
                      src={selectedImages[hoveredFileIndex].url}
                      alt={selectedImages[hoveredFileIndex].filename}
                      className="max-w-[450px] max-h-[450px] object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[300px]">
                        {selectedImages[hoveredFileIndex].filename}
                      </span>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {selectedImages[hoveredFileIndex].mimeType} •{' '}
                        {formatFileSize(selectedImages[hoveredFileIndex].file.size)}
                      </span>
                    </div>
                    <div className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold tracking-wider uppercase">
                      Image
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4 min-w-[320px] max-w-[400px]">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center shadow-sm">
                      {(() => {
                        const ext =
                          selectedImages[hoveredFileIndex].filename.split('.').pop()?.toLowerCase() || '';
                        const iconSize = 32;
                        if (ext === 'pdf' || selectedImages[hoveredFileIndex].mimeType === 'application/pdf')
                          return <FaFilePdf size={iconSize} className="text-red-500" />;
                        if (['xls', 'xlsx', 'csv'].includes(ext))
                          return <FaFileExcel size={iconSize} className="text-green-600" />;
                        if (['doc', 'docx'].includes(ext))
                          return <FaFileWord size={iconSize} className="text-blue-600" />;
                        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext))
                          return <FaFileArchive size={iconSize} className="text-orange-500" />;
                        if (
                          [
                            'js',
                            'ts',
                            'tsx',
                            'py',
                            'java',
                            'c',
                            'cpp',
                            'html',
                            'css',
                            'json',
                            'sh',
                            'sql',
                          ].includes(ext)
                        )
                          return <FaFileCode size={iconSize} className="text-yellow-500 dark:text-yellow-400" />;
                        if (['mp3', 'wav', 'ogg'].includes(ext))
                          return <FaFileAudio size={iconSize} className="text-purple-500" />;
                        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext))
                          return <FaFileVideo size={iconSize} className="text-pink-500" />;
                        return <FaFileAlt size={iconSize} className="text-[var(--color-iconDefault)]" />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate text-base">
                        {selectedImages[hoveredFileIndex].filename}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {selectedImages[hoveredFileIndex].filename.split('.').pop()?.toUpperCase() || 'FILE'}
                        </span>
                        <span className="text-xs text-neutral-400 dark:text-neutral-500">
                          {formatFileSize(selectedImages[hoveredFileIndex].file.size)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-px bg-neutral-200 dark:bg-neutral-800 w-full" />
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 uppercase tracking-widest font-bold">
                    <span>Metadata</span>
                    <span className="text-neutral-300 dark:text-neutral-600">
                      Attachment {hoveredFileIndex + 1}/8
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-neutral-50 dark:bg-black/20 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800/50">
                      <div className="text-[9px] text-neutral-400 mb-0.5">MIME TYPE</div>
                      <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-mono">
                        {selectedImages[hoveredFileIndex].mimeType}
                      </div>
                    </div>
                    <div className="bg-neutral-50 dark:bg-black/20 rounded-lg p-2 border border-neutral-100 dark:border-neutral-800/50">
                      <div className="text-[9px] text-neutral-400 mb-0.5">MODIFIED</div>
                      <div className="text-[11px] text-neutral-700 dark:text-neutral-300 truncate font-mono">
                        {new Date(selectedImages[hoveredFileIndex].file.lastModified).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
