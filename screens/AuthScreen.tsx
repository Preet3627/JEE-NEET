

import React, { useState, useEffect } from 'react';
import LoginScreen from '../components/LoginScreen';
import RegistrationScreen from '../components/RegistrationScreen';
import ForgotPasswordScreen from '../components/ForgotPasswordScreen';
import ResetPasswordScreen from '../components/ResetPasswordScreen';
import { useAuth } from '../context/AuthContext';

type AuthView = 'login' | 'register' | 'forgot' | 'reset';

interface AuthScreenProps {
    backendStatus: 'checking' | 'online' | 'offline' | 'misconfigured';
    googleClientId: string | null;
    resetToken: string | null;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ backendStatus, googleClientId, resetToken }) => {
    const { verificationEmail, setVerificationEmail } = useAuth();
    const [view, setView] = useState<AuthView>('login');

    useEffect(() => {
        if (resetToken) {
            setView('reset');
        } else if (verificationEmail) {
            setView('register'); // This implies the verification step of registration
        }
    }, [resetToken, verificationEmail]);

    const handleSwitchToLogin = () => {
        setView('login');
        setVerificationEmail(null);
    };

    if (view === 'register') {
        return <RegistrationScreen 
                    onSwitchToLogin={handleSwitchToLogin} 
                    backendStatus={backendStatus} 
                    initialEmail={verificationEmail}
                    onVerificationSuccess={handleSwitchToLogin}
                    googleClientId={googleClientId}
                />;
    }

    if (view === 'forgot') {
        return <ForgotPasswordScreen onSwitchToLogin={handleSwitchToLogin} />;
    }

    if (view === 'reset' && resetToken) {
        return <ResetPasswordScreen token={resetToken} onSwitchToLogin={handleSwitchToLogin} />;
    }
    
    return <LoginScreen 
                onSwitchToRegister={() => setView('register')}
                onSwitchToForgotPassword={() => setView('forgot')}
                backendStatus={backendStatus}
                googleClientId={googleClientId}
            />;
};

export default AuthScreen;
