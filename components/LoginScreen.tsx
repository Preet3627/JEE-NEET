

import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';

declare global {
  interface Window {
    google: any;
  }
}

interface LoginScreenProps {
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
    backendStatus: 'checking' | 'online' | 'offline' | 'misconfigured';
    googleClientId: string | null;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister, onSwitchToForgotPassword, backendStatus, googleClientId }) => {
    const { login, googleLogin } = useAuth();
    const [sid, setSid] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);

    useEffect(() => {
        if (window.google && backendStatus === 'online' && googleClientId) {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleCallback,
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("googleSignInButton"),
                    { theme: "outline", size: "large", type: 'standard', text: 'continue_with' }
                );
            } catch (error) {
                console.error("Google Sign-In initialization error:", error);
            }
        }
    }, [backendStatus, googleClientId]);

    const handleGoogleCallback = async (response: any) => {
        setIsGoogleLoading(true);
        setError('');
        try {
            await googleLogin(response.credential);
        } catch (err: any) {
            setError(err.message || 'Google login failed.');
            setIsGoogleLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(sid, password);
        } catch (err: any) {
            setError(err.message || 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputClass = "w-full px-4 py-3 mt-2 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition";
    const labelClass = "text-sm font-bold text-gray-400";
    const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-[var(--gradient-cyan)] to-[var(--gradient-purple)]";

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-purple-500/10 backdrop-blur-md">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white">JEE Scheduler Pro</h1>
                    <p className="mt-2 text-gray-300">Your AI-powered, offline-first study planner.</p>
                     {backendStatus !== 'online' && <p className="mt-4 text-xs text-yellow-400 bg-yellow-900/50 p-2 rounded-md">Backend is offline. Login is disabled. Cached data may be available after login.</p>}
                </div>

                <div className="space-y-4">
                    <div id="googleSignInButton" className={`flex justify-center transition-opacity ${backendStatus !== 'online' || isGoogleLoading || !googleClientId ? 'opacity-50 pointer-events-none' : ''}`}></div>
                    {(isGoogleLoading) && <p className="text-sm text-center text-gray-400 animate-pulse">Verifying...</p>}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800/80 text-gray-400 backdrop-blur-sm">Or with Student ID</span></div>
                    </div>
                 </div>
                 
                 <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="sid" className={labelClass}>Student ID / Email</label>
                        <input id="sid" name="sid" type="text" required className={inputClass} onChange={(e) => setSid(e.target.value)} value={sid} />
                    </div>
                     <div>
                        <div className="flex justify-between items-center">
                            <label htmlFor="password" className={labelClass}>Password</label>
                            <button type="button" onClick={onSwitchToForgotPassword} className="text-xs font-medium text-cyan-400 hover:underline">
                                Forgot Password?
                            </button>
                        </div>
                        <input id="password" name="password" type="password" required className={inputClass} onChange={(e) => setPassword(e.target.value)} value={password} />
                    </div>
                     {error && <p className="text-sm text-center text-red-400">{error}</p>}
                     <button type="submit" disabled={isLoading || isGoogleLoading || backendStatus !== 'online'} className={buttonClass}>
                        {isLoading ? 'Logging in...' : <> <Icon name="login" /> Login </>}
                    </button>
                 </form>
                  <p className="text-sm text-center text-gray-400">
                    Don't have an account?{' '}
                    <button onClick={onSwitchToRegister} className="font-medium text-cyan-400 hover:underline">
                        Register here
                    </button>
                </p>
            </div>
        </div>
    );
};

export default LoginScreen;