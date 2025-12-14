


import React, { useState, useEffect } from 'react';
import { StudyMaterialItem, StudentData, Config } from '../types';
import { api } from '../api/apiService';
import Icon from './Icon';
import { useServerStatus } from '../context/ServerStatusContext';
import { addStudyMaterialToDb, getStudyMaterialFromDb, getAllStudyMaterialsFromDb, deleteStudyMaterialFromDb } from '../utils/studyMaterialDb';

interface StudyMaterialViewProps {
  student: StudentData;
  onUpdateConfig: (config: Partial<Config>) => void;
  onViewFile: (file: StudyMaterialItem) => void;
}

const isViewableFileType = (fileName: string) => {
    const lowerCaseFileName = fileName.toLowerCase();
    return lowerCaseFileName.endsWith('.pdf') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].some(ext => lowerCaseFileName.endsWith(ext));
};

const StudyMaterialView: React.FC<StudyMaterialViewProps> = ({ student, onUpdateConfig, onViewFile }) => {
  const { status } = useServerStatus();
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<StudyMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [pinnedItems, setPinnedItems] = useState<StudyMaterialItem[]>([]);
  const [pinnedItemsLoading, setPinnedItemsLoading] = useState(true);
  const [downloadedMaterials, setDownloadedMaterials] = useState<string[]>([]);
  const [downloadingItems, setDownloadingItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchItems = async () => {
      if (!status) return;
      setIsLoading(true);
      setError('');

      if (!status.studyMaterialWebDAV.configured) {
          setError("The administrator has not configured the study material library.");
          setIsLoading(false);
          return;
      }

      try {
        const data = await api.getStudyMaterial(path);
        setItems(data);
        setError('');
      } catch (err: any) {
        console.error("Failed to load study materials:", err);
        setError(err.error || 'Failed to load study materials.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [path, status]);

  useEffect(() => {
    const fetchPinnedItems = async () => {
        if (!status) return;
      const pinnedPaths = student.CONFIG.pinnedMaterials;
      if (pinnedPaths && pinnedPaths.length > 0) {
        if (!status.studyMaterialWebDAV.configured) {
            setPinnedItems([]);
            setPinnedItemsLoading(false);
            return;
        }
        try {
          setPinnedItemsLoading(true);
          const details = await api.getStudyMaterialDetails(pinnedPaths);
          setPinnedItems(details);
        } catch (e) {
          console.error("Failed to fetch pinned items", e);
        } finally {
          setPinnedItemsLoading(false);
        }
      } else {
        setPinnedItems([]);
        setPinnedItemsLoading(false);
      }
    };
    fetchPinnedItems();
  }, [student.CONFIG.pinnedMaterials, status]);

  // Load downloaded materials from IndexedDB
  useEffect(() => {
    const loadDownloaded = async () => {
      const allDownloaded = await getAllStudyMaterialsFromDb();
      setDownloadedMaterials(allDownloaded.map(m => m.item.path));
    };
    loadDownloaded();
  }, []);

  const handleItemClick = (item: StudyMaterialItem) => {
    if (item.type === 'folder') {
      setPath(item.path);
    } else {
      onViewFile(item);
    }
  };

  const navigateToPath = (index: number) => {
    const pathSegments = path.split('/').filter(Boolean);
    const newPath = '/' + pathSegments.slice(0, index + 1).join('/');
    setPath(newPath);
  };
  
  const goBack = () => {
      if (path === '/') return;
      const parentPath = path.substring(0, path.lastIndexOf('/')) || '/';
      setPath(parentPath);
  };

  const handlePinToggle = (item: StudyMaterialItem) => {
    const currentPins = student.CONFIG.pinnedMaterials || [];
    const isPinned = currentPins.includes(item.path);
    const newPins = isPinned
      ? currentPins.filter(p => p !== item.path)
      : [...currentPins, item.path];
    
    onUpdateConfig({ pinnedMaterials: newPins });
  };

  const handleDownloadOffline = async (e: React.MouseEvent, item: StudyMaterialItem) => {
    e.stopPropagation();
    if (!isViewableFileType(item.name)) {
        alert("This file type cannot be downloaded for offline viewing.");
        return;
    }
    setDownloadingItems(prev => ({ ...prev, [item.path]: true }));
    try {
        const existing = await getStudyMaterialFromDb(item.path);
        if (existing) {
            alert('This material is already saved for offline use.');
            return;
        }

        const blob = await api.getStudyMaterialContent(item.path);
        await addStudyMaterialToDb(item, blob);
        setDownloadedMaterials(prev => [...prev, item.path]);
        alert(`${item.name} has been saved for offline use.`);
    } catch (error) {
        console.error('Error saving study material for offline use:', error);
        alert('Failed to save study material for offline use.');
    } finally {
        setDownloadingItems(prev => ({ ...prev, [item.path]: false }));
    }
  };

  const breadcrumbs = path.split('/').filter(Boolean);
  const pinnedPaths = student.CONFIG.pinnedMaterials || [];

  const unpinnedItems = items.filter(item => !pinnedPaths.includes(item.path));

  const ItemCard: React.FC<{ item: StudyMaterialItem; isPinnedSection?: boolean }> = ({ item, isPinnedSection = false }) => {
    const isPinned = pinnedPaths.includes(item.path);
    const isDownloaded = downloadedMaterials.includes(item.path);
    const isDownloading = downloadingItems[item.path];
    const canViewOffline = isViewableFileType(item.name);

    return (
        <div 
            key={item.path}
            className={`bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-cyan-500/50 transition-colors group relative ${item.type === 'file' ? 'cursor-pointer' : ''}`}
            onClick={() => handleItemClick(item)}
        >
            <div className="flex items-center gap-3">
                <Icon name={item.type === 'folder' ? 'folder' : 'file-text'} className="w-6 h-6 text-cyan-400 flex-shrink-0" />
                <div className="flex-grow min-w-0">
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                        {item.type === 'file' ? `${(item.size / 1024 / 1024).toFixed(2)} MB` : 'Folder'}
                        {item.modified && ` • ${new Date(item.modified).toLocaleDateString()}`}
                    </p>
                </div>
                {item.type === 'file' && (
                    <div className="flex items-center gap-2">
                        {isDownloaded && <Icon name="check-circle" className="w-5 h-5 text-green-500" title="Available Offline" />}
                        {canViewOffline && !isDownloaded && !isPinnedSection && (
                            <button 
                                onClick={(e) => handleDownloadOffline(e, item)} 
                                className="p-1.5 rounded-full bg-black/30 text-gray-400 hover:text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Download for Offline"
                                disabled={isDownloading}
                            >
                                <Icon name={isDownloading ? 'loading' : 'download'} className={`w-4 h-4 ${isDownloading ? 'animate-spin' : ''}`} />
                            </button>
                        )}
                        {!isPinnedSection && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); handlePinToggle(item); }} 
                                className="p-1.5 rounded-full bg-black/30 text-gray-400 hover:text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                title={isPinned ? 'Unpin' : 'Pin to Dashboard'}
                            >
                                <Icon name="pin" className={`w-4 h-4 ${isPinned ? 'text-yellow-400 fill-current' : ''}`} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Study Material</h2>
        <div className="flex items-center gap-2">
            {path !== '/' && (
                <button onClick={goBack} className="p-2 rounded-full bg-gray-700/50 hover:bg-gray-700 text-gray-300 hover:text-white" title="Go Back">
                    <Icon name="arrow-left" className="w-4 h-4" />
                </button>
            )}
        </div>
      </div>

      <div className="mb-4">
        <nav className="text-sm font-semibold text-gray-400 flex items-center flex-wrap gap-x-2">
          <button onClick={() => setPath('/')} className="hover:text-white">Home</button>
          {breadcrumbs.map((segment, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-600">/</span>
              <button onClick={() => navigateToPath(index)} className="hover:text-white">{segment}</button>
            </React.Fragment>
          ))}
        </nav>
      </div>

      {pinnedItemsLoading && student.CONFIG.pinnedMaterials?.length > 0 ? (
          <div className="text-center text-gray-400 py-8">Loading pinned items...</div>
      ) : pinnedItems.length > 0 && path === '/' && (
        <div className="mb-8">
            <h3 className="text-xl font-semibold text-yellow-400 tracking-wider uppercase mb-4 border-b border-yellow-500/20 pb-2">Pinned for Quick Access</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedItems.map(item => (
                    <ItemCard key={item.path} item={item} isPinnedSection={true} />
                ))}
            </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center text-gray-400 py-10">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          Loading items...
        </div>
      ) : error ? (
        <div className="text-center text-yellow-400 py-10 border-2 border-dashed border-yellow-500/30 rounded-lg mx-4">
            <p className="font-semibold">Study Material Notice</p>
            <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-cyan-400 tracking-wider uppercase mb-4 border-b border-cyan-500/20 pb-2">{path === '/' ? 'All Material' : 'Folder Contents'}</h3>
          {unpinnedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unpinnedItems.map(item => (
                <ItemCard key={item.path} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-10">This folder is empty.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyMaterialView;