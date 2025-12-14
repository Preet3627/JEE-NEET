

import React, { useState, useRef } from 'react';
import { StudentData } from '../types';
import { useAuth } from '../context/AuthContext';
import Icon from './Icon';
import { api } from '../api/apiService';

interface ProfileModalProps {
  user: StudentData | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose }) => {
  const { updateProfile, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        fullName: fullName !== user?.fullName ? fullName : undefined,
        profilePhoto: profilePhoto !== user?.profilePhoto ? profilePhoto : undefined,
      });
      setIsEditing(false);
      refreshUser(); // To show updated data in modal without closing
    } catch (error) {
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateToken = async () => {
    if (window.confirm("Are you sure? Generating a new token will invalidate any old one.")) {
      try {
        const { token } = await api.generateApiToken();
        setApiToken(token);
      } catch (error) {
        alert("Failed to generate token.");
      }
    }
  };

  const handleRevokeToken = async () => {
      if (window.confirm("Are you sure you want to revoke your API token? Any scripts using it will stop working.")) {
          try {
              await api.revokeApiToken();
              setApiToken(null);
              alert("Token revoked.");
          } catch (error) {
              alert("Failed to revoke token.");
          }
      }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-md bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl ${contentAnimationClasses} overflow-y-auto max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        {/* MacOS Traffic Light Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-black/20">
            <button onClick={handleClose} className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 shadow-inner"></button>
            <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-inner"></div>
            <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-inner"></div>
            <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">My Profile</span>
        </div>

        <div className="p-6">
            <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Account Details</h2>
            {!isEditing && (
                <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white rounded-lg bg-gray-700 hover:bg-gray-600">
                <Icon name="edit" className="w-4 h-4"/> Edit
                </button>
            )}
            </div>

            <div className="mt-6 flex flex-col items-center">
                <div className="relative">
                    <img src={profilePhoto} alt={fullName} className="w-24 h-24 rounded-full object-cover border-4 border-cyan-500/50" />
                    {isEditing && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-1.5 bg-gray-900 rounded-full text-white hover:bg-gray-700">
                            <Icon name="upload" className="w-4 h-4" />
                        </button>
                    )}
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                </div>

                {isEditing ? (
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-4 w-full text-center text-xl font-bold bg-gray-900/50 border border-gray-600 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                ) : (
                    <h3 className="mt-4 text-2xl font-bold text-white">{fullName}</h3>
                )}
            
                            <p className="text-sm text-gray-400">{user?.sid}</p>
                            <p className="text-sm text-gray-400">{user?.email}</p>            </div>
            
            <div className="mt-6 border-t border-gray-700/50 pt-6">
                <h3 className="text-lg font-bold text-white mb-2">API Access</h3>
                <p className="text-xs text-gray-400 mb-4">Use this token to allow external services (like custom AI agents) to securely push data to your account.</p>
                {apiToken ? (
                    <div className="bg-gray-900/50 p-3 rounded-lg">
                        <p className="text-xs text-yellow-400">This token is shown only once. Copy it now and store it securely.</p>
                        <div className="relative mt-2">
                            <pre className="text-xs font-mono bg-gray-800 p-2 rounded-md break-all pr-10">{apiToken}</pre>
                            <button onClick={() => handleCopy(apiToken)} className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-300 hover:text-white">
                                <Icon name={copied ? 'check' : 'copy'} className={`w-4 h-4 ${copied ? 'text-green-400' : ''}`} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={handleGenerateToken} className="flex-1 px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600/80 hover:bg-cyan-500/80">Generate Token</button>
                        <button onClick={handleRevokeToken} className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-800/80 hover:bg-red-700/80">Revoke Token</button>
                    </div>
                )}
            </div>


            <div className="mt-8 flex justify-end gap-4">
            {isEditing ? (
                <>
                <button onClick={() => { setIsEditing(false); setFullName(user.fullName); setProfilePhoto(user.profilePhoto); }} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Cancel</button>
                <button onClick={handleSave} disabled={isSaving} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:opacity-90 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
                </>
            ) : (
                <button onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
