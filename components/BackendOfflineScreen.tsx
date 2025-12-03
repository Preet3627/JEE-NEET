

import React from 'react';
import Icon from './Icon';

interface BackendOfflineScreenProps {
  onSelectDemoUser: (role: 'student' | 'admin') => void;
  onRetryConnection: () => void;
  backendStatus: 'offline' | 'misconfigured' | 'checking';
}

const BackendOfflineScreen: React.FC<BackendOfflineScreenProps> = ({ onSelectDemoUser, onRetryConnection, backendStatus }) => {
    
    const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none";

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-red-500/10 backdrop-blur-md text-center">
                <Icon name="bell" className="w-16 h-16 text-yellow-400 mx-auto animate-pulse" />
                <h1 className="text-3xl font-bold text-white mt-4">Connection Error</h1>
                <p className="text-gray-300">
                    The application server is currently offline. You can either try to reconnect or explore the app using a demo account.
                </p>
                
                <div className="pt-4 space-y-4">
                    <button 
                        onClick={onRetryConnection} 
                        className={`${buttonClass} bg-gray-700 hover:bg-gray-600`}
                    >
                        Retry Connection
                    </button>
                    
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800/80 text-gray-400 backdrop-blur-sm">Or use Demo Mode</span></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button 
                            onClick={() => onSelectDemoUser('student')} 
                            className={`${buttonClass} bg-gradient-to-r from-cyan-600 to-blue-600`}
                        >
                            <Icon name="user-plus" /> Demo Student
                        </button>
                        <button 
                            onClick={() => onSelectDemoUser('admin')} 
                            className={`${buttonClass} bg-gradient-to-r from-purple-600 to-indigo-600`}
                        >
                           <Icon name="users" /> Demo Admin
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackendOfflineScreen;
