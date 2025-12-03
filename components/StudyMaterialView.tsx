

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
        // FIX: Ensure `api.getStudyMaterial` exists
        const data = await api.getStudyMaterial(path);
        setItems(data);
        setError(''); // Clear error if successful
      } catch (err: any) {
        console.error("Failed to load study materials:", err);
        setError(err.error || 'Failed to load study materials. Please ensure Nextcloud WebDAV is configured correctly in your server\'s .env file.');
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
          // FIX: Ensure `api.getStudyMaterialDetails` exists
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

  const breadcrumbs = path.split('/').filter(Boolean);
  const pinnedPaths = student.CONFIG.pinnedMaterials || [];

  const unpinnedItems = items.filter(item => !pinnedPaths.includes(item.path));

  const ItemCard: React.FC<{ item: StudyMaterialItem; isPinnedSection?: boolean }> = ({ item, isPinnedSection = false }) => {
    const isPinned = pinnedPaths.includes(item.path);
    return (
        <