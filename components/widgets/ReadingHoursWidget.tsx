import React from 'react';
// @ts-ignore: virtual module types not found in this project
import { useRegisterSW } from 'virtual:pwa-register/react';
import Icon from './Icon';

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error:', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (needRefresh) {
    return (
      <div className="fixed right-4 bottom-24 z-50 p-4 rounded-lg shadow-lg bg-gray-800 border border-gray-600 flex items-center gap-4 animate-scaleIn">
        <div className="text-white">
          <div className="font-semibold">New version available!</div>
          <div className="text-sm text-gray-300">Reload to get the latest updates.</div>
        </div>
        <button
          className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 text-white hover:bg-cyan-500"
          onClick={() => updateServiceWorker(true)}
        >
          Reload
        </button>
      </div>
    );
  }

  if (offlineReady) {
    return (
        <div className="fixed right-4 bottom-24 z-50 p-4 rounded-lg shadow-lg bg-gray-800 border border-gray-600 flex items-center gap-4 animate-scaleIn">
            <div className="text-white">
                <div className="font-semibold">App ready to work offline.</div>
            </div>
            <button
                className="p-2 text-gray-300 hover:text-white"
                onClick={() => close()}
            >
                &times;
            </button>
        </div>
    );
  }

  return null;
}

export default ReloadPrompt;