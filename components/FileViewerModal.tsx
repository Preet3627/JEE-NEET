
import React, { useState, useEffect, useRef } from 'react';
import { StudyMaterialItem } from '../types';
import Icon from './Icon';
import { api } from '../api/apiService';

interface FileViewerModalProps {
  file: StudyMaterialItem | null;
  onClose: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({ file, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };
  
  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
        modalRef.current.requestFullscreen().catch(err => alert(`Error enabling full-screen: ${err.message}`));
    } else {
        document.exitFullscreen();
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    let url: string | null = null;
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf');
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => fileName.endsWith(ext));
    const isViewable = isPdf || isImage;

    const loadFile = async () => {
      if (!isViewable) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      setError('');
      setObjectUrl(null);

      try {
        const blob = await api.getStudyMaterialContent(file.path);
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (e: any) {
        setError("Could not load file preview. It might be too large or an error occurred.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();

    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  if (!file) return null;

  const handleDownload = async () => {
    setIsLoading(true);
    setError('');
    try {
        const blob = await api.getStudyMaterialContent(file.path);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (e) {
        setError("Download failed. Please check your connection.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleOpenExternal = () => {
      if(objectUrl) {
          window.open(objectUrl, '_blank');
      }
  };


  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';
  
  const fileName = file.name.toLowerCase();
  const isPdf = fileName.endsWith('.pdf');
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => fileName.endsWith(ext));
  const isViewable = isPdf || isImage;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center text-white p-8">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-400">Loading file...</p>
        </div>
      );
    }
    if (error) {
       return (
        <div className="flex flex-col items-center justify-center h-full text-center text-red-400 p-8">
            <Icon name="bell" className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Error</h3>
            <p className="text-gray-300">{error}</p>
        </div>
       );
    }
    if (isViewable && objectUrl) {
      if (isPdf) {
        // Mobile-specific view: Offer direct open or download as native embeds are flaky
        if (isMobile) {
             return (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <Icon name="file-text" className="w-20 h-20 text-red-500 mb-4" />
                    <h3 className="text-lg font-bold text-white mb-2">PDF Document</h3>
                    <p className="text-gray-400 mb-6 text-sm">For the best experience on mobile, open this PDF in your browser's native viewer.</p>
                    <button 
                        onClick={handleOpenExternal}
                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-semibold shadow-lg mb-4 w-full max-w-xs"
                    >
                        Open PDF
                    </button>
                </div>
             )
        }
        // Desktop: Use Object tag
        return (
            <object data={objectUrl} type="application/pdf" className="w-full h-full rounded-lg border-0">
                <p className="text-center text-gray-400 mt-10">
                    It appears your browser cannot render this PDF directly. <br/>
                    <button onClick={handleDownload} className="text-cyan-400 underline mt-2">Download it instead.</button>
                </p>
            </object>
        );
      }
      if (isImage) {
        return <img src={objectUrl} alt={file.name} className="max-w-full max-h-full object-contain rounded-lg" />;
      }
    }
    
    // Fallback for non-viewable files
    return (
      <div className="flex flex-col items-center justify-center h-full text-center text-white p-8">
        <Icon name="file-text" className="w-24 h-24 text-gray-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Preview not available</h3>
        <p className="text-gray-400 mb-6">This file type cannot be displayed directly in the app.</p>
        <button 
          onClick={handleDownload}
          className="px-6 py-3 text-base font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white flex items-center gap-2 shadow-lg"
        >
          <Icon name="upload" className="w-5 h-5 transform rotate-180"/> Download File
        </button>
      </div>
    );
  };

  return (
    <div className={`fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-md ${animationClasses}`} onClick={handleClose}>
      <div ref={modalRef} className={`w-full h-full max-w-5xl max-h-[90vh] bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses} flex flex-col`} onClick={(e) => e.stopPropagation()}>
        <header className="flex-shrink-0 p-4 border-b border-[var(--glass-border)] flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden">
             <Icon name={isPdf ? 'file-text' : 'image'} className="w-5 h-5 text-cyan-400 flex-shrink-0" />
             <h2 className="text-lg font-bold text-white truncate">{file.name}</h2>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {isViewable && !isMobile && (
                <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 transition-colors" title="Toggle Fullscreen">
                    <Icon name="expand" className="w-4 h-4" />
                </button>
            )}
            <button onClick={handleDownload} className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600 transition-colors" title="Download">
                <Icon name="upload" className="w-4 h-4 transform rotate-180" />
            </button>
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
        </header>
        <main className="flex-grow flex items-center justify-center overflow-hidden p-2 bg-gray-900/50 relative">
            {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default FileViewerModal;
