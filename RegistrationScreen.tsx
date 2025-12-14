import React, { useState, useEffect } from 'react';
import Icon from './components/Icon';
import { useAuth } from './context/AuthContext';
import { api } from './api/apiService';

interface RegistrationScreenProps {
    onSwitchToLogin: () => void;
    backendStatus: 'checking' | 'online' | 'offline' | 'misconfigured';
    initialEmail: string | null;
    onVerificationSuccess: () => void;
    // googleClientId: string | null; // No longer passed as prop, now from AuthContext
}

const RegistrationScreen: React.FC<RegistrationScreenProps> = ({ onSwitchToLogin, backendStatus, initialEmail, onVerificationSuccess }) => {
    const { googleLogin, loginWithToken, googleClientId, googleAuthStatus, setGoogleAuthStatus } = useAuth();
    const [formData, setFormData] = useState({ fullName: '', sid: '', email: initialEmail || '', password: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // const [isGoogleLoading, setIsGoogleLoading] = useState(false); // Managed by AuthContext googleAuthStatus

    useEffect(() => {
        // Render Google button when googleAuthStatus indicates it's ready (not loading or unconfigured)
        if (window.google && googleClientId && googleAuthStatus !== 'loading' && googleAuthStatus !== 'unconfigured' && backendStatus === 'online') {
            try {
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: handleGoogleCallback,
                });
                window.google.accounts.id.renderButton(
                    document.getElementById("googleSignUpButton"),
                    { theme: "outline", size: "large", type: 'standard', text: 'signup_with' }
                );
            } catch (error) {
                console.error("Google Sign-Up render button error:", error);
                setGoogleAuthStatus('unconfigured'); // Mark as unconfigured if rendering fails
            }
        }
    }, [googleClientId, googleAuthStatus, backendStatus]); // Re-render when these change

    const handleGoogleCallback = async (response: any) => {
        setGoogleAuthStatus('loading'); // Indicate Google sign-up is in progress
        setError('');
        try {
            await googleLogin(response.credential);
            onVerificationSuccess();
            // googleAuthStatus will be set to 'signed_in' by AuthContext on success
        } catch (err: any) {
            setError(err.message || 'Google sign-up failed.');
            setGoogleAuthStatus('signed_out'); // Reset status on failure
        }
    };
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            const data = await api.register(formData);
            if (data.token) { 
                 // Direct login without verification
                 loginWithToken(data.token);
                 onVerificationSuccess();
            } else {
                setError("Registration successful but no token returned.");
            }
        } catch (err: any) {
            setError(err.error || err.message || 'Registration failed.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputClass = "w-full px-4 py-3 mt-2 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition";
    const labelClass = "text-sm font-bold text-gray-400";
    const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--gradient-cyan)] to-[var(--gradient-purple)]";

    const isGoogleButtonDisabled = backendStatus !== 'online' || !googleClientId || googleAuthStatus === 'loading' || googleAuthStatus === 'unconfigured';

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-purple-500/10 backdrop-blur-md">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white">Create Account</h1>
                    <p className="mt-2 text-gray-400">Join JEE Scheduler Pro</p>
                     {backendStatus !== 'online' && <p className="mt-4 text-xs text-yellow-400 bg-yellow-900/50 p-2 rounded-md">Backend is offline. Registration is disabled.</p>}
                </div>

                <div className="space-y-4">
                    {/* Render Google Sign-Up button only if configured and ready */}
                    {googleClientId && googleAuthStatus !== 'unconfigured' && (
                        <div id="googleSignUpButton" className={`flex justify-center transition-opacity ${isGoogleButtonDisabled ? 'opacity-50 pointer-events-none' : ''}`}></div>
                    )}
                    {googleAuthStatus === 'loading' && <p className="text-sm text-center text-gray-400 animate-pulse">Creating account with Google...</p>}
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-600"></div></div>
                        <div className="relative flex justify-center text-sm"><span className="px-2 bg-gray-800 text-gray-400">Or with an Email</span></div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="fullName" className={labelClass}>Full Name</label>
                        <input id="fullName" name="fullName" type="text" required className={inputClass} onChange={handleInputChange} value={formData.fullName} />
                    </div>
                        <div>
                        <label htmlFor="sid" className={labelClass}>Student ID / Username</label>
                        <input id="sid" name="sid" type="text" required className={inputClass} onChange={handleInputChange} value={formData.sid} />
                    </div>
                    <div>
                        <label htmlFor="email" className={labelClass}>Email</label>
                        <input id="email" name="email" type="email" required className={inputClass} onChange={handleInputChange} value={formData.email} />
                    </div>
                    <div>
                        <label htmlFor="password" className={labelClass}>Password</label>
                        <input id="password" name="password" type="password" required className={inputClass} onChange={handleInputChange} value={formData.password} />
                    </div>
                    {error && <p className="text-sm text-center text-red-400">{error}</p>}
                    <button type="submit" disabled={isLoading || isGoogleButtonDisabled || backendStatus !== 'online'} className={buttonClass}>
                        {isLoading ? 'Creating Account...' : <> <Icon name="user-plus" /> Sign Up </>}
                    </button>
                </form>

                 <p className="text-sm text-center text-gray-400">
                    Already have an account?{' '}
                    <button onClick={onSwitchToLogin} className="font-medium text-cyan-400 hover:underline">
                        Login here
                    </button>
                </p>
            </div>
        </div>
    );
};

export default RegistrationScreen;