
import React, { useState } from 'react';
import Icon from './Icon';
import { api } from '../api/apiService';

interface ResetPasswordScreenProps {
  token: string;
  onSwitchToLogin: () => void;
}

const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ token, onSwitchToLogin }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const data = await api.resetPassword(token, password);
      setMessage(data.message);
    } catch (err: any) {
      setError(err.error || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 mt-2 text-gray-200 bg-gray-900/50 border border-[var(--glass-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 transition";
  const labelClass = "text-sm font-bold text-gray-400";
  const buttonClass = "w-full flex items-center justify-center gap-2 px-4 py-3 text-base font-semibold text-white rounded-lg transition-transform hover:scale-105 active:scale-100 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-[var(--gradient-cyan)] to-[var(--gradient-purple)]";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl shadow-purple-500/10 backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Set New Password</h1>
        </div>

        {message ? (
          <div className="text-center space-y-4">
            <p className="text-green-400">{message}</p>
            <button onClick={onSwitchToLogin} className={`${buttonClass} mt-4`}>
              Proceed to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className={labelClass}>New Password</label>
              <input id="password" name="password" type="password" required className={inputClass} onChange={(e) => setPassword(e.target.value)} value={password} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className={labelClass}>Confirm New Password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required className={inputClass} onChange={(e) => setConfirmPassword(e.target.value)} value={confirmPassword} />
            </div>
            {error && <p className="text-sm text-center text-red-400">{error}</p>}
            <button type="submit" disabled={isLoading} className={buttonClass}>
              {isLoading ? 'Saving...' : 'Set New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordScreen;
