
import React, { useState } from 'react';
import Icon from './Icon';
import { api } from '../api/apiService';

interface ForgotPasswordScreenProps {
  onSwitchToLogin: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const data = await api.forgotPassword(email);
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
          <h1 className="text-3xl font-bold text-white">Reset Password</h1>
          <p className="mt-2 text-gray-400">Enter your email to receive a reset link.</p>
        </div>

        {message ? (
          <div className="text-center space-y-4">
            <p className="text-green-400">{message}</p>
            <button onClick={onSwitchToLogin} className="font-medium text-cyan-400 hover:underline">
              Back to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" name="email" type="email" required className={inputClass} onChange={(e) => setEmail(e.target.value)} value={email} />
            </div>
            {error && <p className="text-sm text-center text-red-400">{error}</p>}
            <button type="submit" disabled={isLoading} className={buttonClass}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-sm text-center text-gray-400">
          Remembered your password?{' '}
          <button onClick={onSwitchToLogin} className="font-medium text-cyan-400 hover:underline">
            Login here
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordScreen;
