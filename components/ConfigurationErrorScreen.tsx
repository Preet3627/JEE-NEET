

import React from 'react';
import Icon from './Icon';

interface ConfigurationErrorScreenProps {
  onRetryConnection: () => void;
  backendStatus: 'offline' | 'misconfigured' | 'checking';
}

const ConfigurationErrorScreen: React.FC<ConfigurationErrorScreenProps> = ({ onRetryConnection, backendStatus }) => {
    
    const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gray-700 hover:bg-gray-600";

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-red-500/10 backdrop-blur-md text-center">
                <Icon name="settings" className="w-16 h-16 text-red-500 mx-auto animate-spin [animation-duration:3s]" />
                <h1 className="text-3xl font-bold text-white mt-4">Server Misconfigured</h1>
                <div className="text-left bg-gray-900/50 p-4 rounded-lg border border-red-500/30 text-sm text-gray-300 space-y-2">
                    <p>
                        The backend server has started but is not properly configured. This usually means the <strong>.env</strong> file is missing or essential variables are not set.
                    </p>
                    <p className="font-semibold">
                        Action Required (for Administrators):
                    </p>
                    <ul className="list-disc list-inside text-xs text-gray-400 pl-2">
                        <li>Ensure a <code>.env</code> file exists in the server's root directory.</li>
                        <li>Check that all required variables (<code>DB_HOST</code>, <code>DB_USER</code>, <code>JWT_SECRET</code>, etc.) are correctly set.</li>
                        <li>Restart the server after making changes.</li>
                    </ul>
                </div>
                
                <div className="pt-4">
                    <button 
                        onClick={onRetryConnection} 
                        className={buttonClass}
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationErrorScreen;
