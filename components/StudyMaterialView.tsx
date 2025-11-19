

import React, { useState, useEffect } from 'react';
import { StudyMaterialItem, StudentData, Config } from '../types';
import { api } from '../api/apiService';
import Icon from './Icon';

interface StudyMaterialViewProps {
  student: StudentData;
  onUpdateConfig: (config: Partial<Config>) => void;
  onViewFile: (file: StudyMaterialItem) => void;
}

const StudyMaterialView: React.FC<StudyMaterialViewProps> = ({ student, onUpdateConfig, onViewFile }) => {
  const [path, setPath] = useState('/');
  const [items, setItems] = useState<StudyMaterialItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [pinnedItems, setPinnedItems] = useState<StudyMaterialItem[]>([]);
  const [pinnedItemsLoading, setPinnedItemsLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await api.getStudyMaterial(path);
        setItems(data);
      } catch (err: any) {
        setError(err.error || 'Failed to load study materials. The repository may not be configured by the administrator.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [path]);

  useEffect(() => {
    const fetchPinnedItems = async () => {
      const pinnedPaths = student.CONFIG.pinnedMaterials;
      if (pinnedPaths && pinnedPaths.length > 0) {
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
  }, [student.CONFIG.pinnedMaterials]);

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

  const handlePinToggle = (item: StudyMaterialItem) => {
    const currentPins = student.CONFIG.pinnedMaterials || [];
    const isPinned = currentPins.includes(item.path);
    const newPins = isPinned
      ? currentPins.filter(p => p !== item.path)
      : [...currentPins, item.path];
    
    onUpdateConfig({ pinnedMaterials: newPins });
  };

  const breadcrumbs = path.split('/').filter(Boolean);
  const pinnedPaths = student.CONFIG.pinnedMaterials || [];

  const unpinnedItems = items.filter(item => !pinnedPaths.includes(item.path));

  const ItemCard: React.FC<{ item: StudyMaterialItem; isPinnedSection?: boolean }> = ({ item, isPinnedSection = false }) => {
    const isPinned = pinnedPaths.includes(item.path);
    return (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500 text-left flex items-center gap-4 group relative">
            <button onClick={() => handleItemClick(item)} className="flex-grow flex items-center gap-4 p-4 overflow-hidden min-w-0">
                <Icon name={item.type === 'folder' ? 'folder' : 'file-text'} className="w-8 h-8 text-cyan-400 flex-shrink-0" />
                <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">{new Date(item.modified).toLocaleDateString()}</p>
                </div>
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); handlePinToggle(item); }} 
                className={`p-2 rounded-full text-gray-500 hover:text-yellow-400 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity ${isPinned ? 'opacity-100' : ''}`}
                title={isPinned ? 'Unpin item' : 'Pin item'}
            >
                <Icon name="pin" className={`w-5 h-5 ${isPinned ? 'fill-current text-yellow-400' : ''}`} />
            </button>
        </div>
    );
  };

  return (
    <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-2xl font-bold text-white mb-4">Study Material</h2>

      {(pinnedItemsLoading || pinnedItems.length > 0) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-cyan-400 mb-3 flex items-center gap-2">
            <Icon name="pin" className="w-5 h-5 text-yellow-400" /> Pinned Items
          </h3>
          {pinnedItemsLoading ? (
            <div className="text-center text-sm text-gray-400">Loading pins...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pinnedItems.map(item => <ItemCard key={`pinned-${item.path}`} item={item} isPinnedSection />)}
            </div>
          )}
          <div className="border-t border-gray-700/50 my-6"></div>
        </div>
      )}
      
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 bg-gray-900/50 p-2 rounded-md overflow-x-auto">
        <button onClick={() => setPath('/')} className="hover:text-white flex-shrink-0">Home</button>
        {breadcrumbs.map((segment, index) => (
          <React.Fragment key={index}>
            <span className="flex-shrink-0">/</span>
            <button onClick={() => navigateToPath(index)} className="hover:text-white flex-shrink-0 truncate">{segment}</button>
          </React.Fragment>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-48">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="text-center text-red-400 py-10 border-2 border-dashed border-red-500/30 rounded-lg">
            <p className="font-semibold">Error Loading Resources</p>
            <p className="text-sm">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {unpinnedItems.map(item => <ItemCard key={item.path} item={item} />)}
          {unpinnedItems.length === 0 && <p className="col-span-full text-center text-gray-500 py-10">This folder is empty.</p>}
        </div>
      )}
    </div>
  );
};

export default StudyMaterialView;