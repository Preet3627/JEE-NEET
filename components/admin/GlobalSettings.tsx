import React, { useState, useEffect } from 'react';
import { api } from '../../api/apiService';
import Icon from '../Icon';
import { useServerStatus } from '../../context/ServerStatusContext';

interface GlobalSettingsProps {
    refreshServerStatus: () => Promise<void>;
}

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ refreshServerStatus }) => {
    const { status } = useServerStatus();
    const [djDropUrl, setDjDropUrl] = useState(status?.djDropUrl || '');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (status?.djDropUrl) {
            setDjDropUrl(status.djDropUrl);
        }
    }, [status?.djDropUrl]);

    const handleSaveDjDropUrl = async () => {
        setIsSaving(true);
        setMessage(null);
        try {
            await api.updateGlobalSetting('dj_drop_url', djDropUrl);
            await refreshServerStatus(); // Refresh global status to reflect changes
            setMessage({ text: 'DJ Drop URL saved successfully!', type: 'success' });
        } catch (error: any) {
            console.error("Failed to save DJ Drop URL:", error);
            setMessage({ text: `Failed to save DJ Drop URL: ${error.message}`, type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-gray-800/70 p-6 rounded-lg border border-gray-700 max-w-2xl mx-auto space-y-6">
            <h3 className="font-bold text-white text-lg mb-4 flex items-center gap-2">
                <Icon name="settings" className="w-5 h-5 text-purple-400" /> Global Application Settings
            </h3>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-gray-400">DJ Drop Sound URL</label>
                </div>
                <input 
                    type="url"
                    value={djDropUrl}
                    onChange={(e) => setDjDropUrl(e.target.value)}
                    placeholder="Enter URL for global DJ drop sound"
                    className="w-full px-4 py-2 text-sm text-gray-200 bg-gray-900/50 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button 
                    onClick={handleSaveDjDropUrl} 
                    disabled={isSaving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 shadow-lg disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save DJ Drop URL'}
                </button>
                {message && (
                    <p className={`text-sm mt-2 ${message.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {message.text}
                    </p>
                )}
            </div>
        </div>
    );
};

export default GlobalSettings;
