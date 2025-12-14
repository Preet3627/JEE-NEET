
import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/apiService'; // Import apiService

declare global {
  interface Window {
    google: any;
  }
}

interface LoginScreenProps {
    onSwitchToRegister: () => void;
    onSwitchToForgotPassword: () => void;
    backendStatus: 'checking' | 'online' | 'offline' | 'misconfigured';
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onSwitchToRegister, onSwitchToForgotPassword, backendStatus }) => {
    const { login, googleLogin, googleClientId, googleAuthStatus, setGoogleAuthStatus } = useAuth();
    const [sid, setSid] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [emailToVerify, setEmailToVerify] = useState<string | null>(null); // State to hold email for verification
    const [resendEmailStatus, setResendEmailStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    useEffect(() => {
        if (window.google && googleClientId && googleAuthStatus !== 'loading' && backendStatus === 'online') {
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
                console.error("Google Sign-In render button error:", error);
                setGoogleAuthStatus('unconfigured');
            }
        }
    }, [googleClientId, googleAuthStatus, backendStatus]);

    const handleGoogleCallback = async (response: any) => {
        setError('');
        setIsLoading(true); // Set local loading state
        try {
            await googleLogin(response.credential);
        } catch (err: any) {
            setError(err.message || 'Google login failed.');
        } finally {
            setIsLoading(false); // Reset local loading state
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setEmailToVerify(null); // Clear previous verification email
        setIsLoading(true);
        try {
            await login(sid, password);
        } catch (err: any) {
            if (err.needsVerification && err.email) {
                setEmailToVerify(err.email);
                setError(err.message || 'Login failed. Please verify your email.');
            } else {
                setError(err.message || 'Login failed.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        if (!emailToVerify) return;
        setResendEmailStatus('loading');
        try {
            await api.resendVerificationEmail(emailToVerify);
            setResendEmailStatus('success');
            setError('Verification email sent! Check your inbox.');
        } catch (err: any) {
            setResendEmailStatus('error');
            setError(err.message || 'Failed to resend verification email.');
        }
    };
    
    const inputClass = "w-full px-4 py-3 mt-2 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition";
    const labelClass = "text-sm font-bold text-gray-400";
    const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none bg-gradient-to-r from-[var(--gradient-cyan)] to-[var(--gradient-purple)]";

    const isGoogleButtonDisabled = backendStatus !== 'online' || !googleClientId || googleAuthStatus === 'loading';

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-purple-500/10 backdrop-blur-md">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white">JEE Scheduler Pro</h1>
                    <p className="mt-2 text-gray-300">Your AI-powered, offline-first study planner.</p>
                     {backendStatus !== 'online' && <p className="mt-4 text-xs text-yellow-400 bg-yellow-900/50 p-2 rounded-md">Backend is offline. Login is disabled. Cached data may be available after login.</p>}
                </div>

                <div className="space-y-4">
                    {/* Render Google Sign-In button only if configured and ready */}
                    <div id="googleSignInButton" className={`flex justify-center transition-opacity ${isGoogleButtonDisabled ? 'opacity-50 pointer-events-none' : ''}`}></div>
                    {googleAuthStatus === 'loading' && <p className="text-sm text-center text-gray-400 animate-pulse">Verifying Google account...</p>}
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
                    {emailToVerify && (
                        <div className="text-center text-sm mt-2">
                            <p className="text-yellow-400 mb-2">Your email <span className="font-bold">{emailToVerify}</span> is not verified.</p>
                            <button 
                                type="button" 
                                onClick={handleResendVerification} 
                                disabled={resendEmailStatus === 'loading'}
                                className="text-cyan-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {resendEmailStatus === 'loading' ? 'Sending...' : 'Resend Verification Email'}
                            </button>
                            {resendEmailStatus === 'success' && <p className="text-green-400">Email sent! Check your inbox.</p>}
                            {resendEmailStatus === 'error' && <p className="text-red-400">Failed to send. Try again.</p>}
                        </div>
                    )}
                     <button type="submit" disabled={isLoading || isGoogleButtonDisabled || backendStatus !== 'online'} className={buttonClass}>
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