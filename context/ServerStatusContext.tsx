import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { api } from '../api/apiService';

interface ServerStatus {
    database: { configured: boolean; connected: boolean; status: string; };
    googleAI: { configured: boolean; initialized: boolean; status: string; };
    googleAuth: { configured: boolean; initialized: boolean; status: string; };
    studyMaterialWebDAV: { configured: boolean; initialized: boolean; status: string; };
    musicWebDAV: { configured: boolean; initialized: boolean; status: string; };
    email: { configured: boolean; initialized: boolean; status: string; };
    djDropUrl?: string;
}

interface ServerStatusContextType {
    status: ServerStatus | null;
    isLoading: boolean;
    error: string | null;
    refreshStatus: () => Promise<void>;
}

const ServerStatusContext = createContext<ServerStatusContextType | undefined>(undefined);

export const ServerStatusProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [status, setStatus] = useState<ServerStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refreshStatus = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getStatus();
            setStatus(response.checks);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch server status.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshStatus();
    }, []);

    const value = { status, isLoading, error, refreshStatus };

    return <ServerStatusContext.Provider value={value}>{children}</ServerStatusContext.Provider>;
};

export const useServerStatus = () => {
    const context = useContext(ServerStatusContext);
    if (context === undefined) {
        throw new Error('useServerStatus must be used within a ServerStatusProvider');
    }
    return context;
};
