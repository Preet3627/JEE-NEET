

import React, { useState } from 'react';
import Icon from './Icon';

interface GoogleAssistantGuideModalProps {
  onClose: () => void;
}

const GoogleAssistantGuideModal: React.FC<GoogleAssistantGuideModalProps> = ({ onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 300);
  };

  const animationClasses = isExiting ? 'modal-exit' : 'modal-enter';
  const contentAnimationClasses = isExiting ? 'modal-content-exit' : 'modal-content-enter';

  const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-4">
      <h3 className="text-lg font-bold text-cyan-400 mb-2">{title}</h3>
      <div className="space-y-2 text-sm text-gray-300 bg-gray-900/50 p-3 rounded-lg border border-gray-700">
        {children}
      </div>
    </div>
  );

  const Command: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="bg-gray-800 p-2 rounded-md font-mono text-xs text-gray-200">
      <span className="text-gray-500 mr-1">"</span>{children}<span className="text-gray-500 ml-1">"</span>
    </p>
  );

  return (
    <div className={`fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${animationClasses}`} onClick={handleClose}>
      <div className={`w-full max-w-2xl bg-[var(--glass-bg)] border border-[var(--glass-border)] rounded-xl shadow-2xl p-6 ${contentAnimationClasses} flex flex-col max-h-[90vh]`} onClick={(e) => e.stopPropagation()}>
        <header className="flex-shrink-0 mb-4">
          <h2 className="text-2xl font-bold text-white">Using Google Assistant</h2>
          <p className="text-sm text-gray-400">Control your schedule with your voice.</p>
        </header>

        <main className="flex-grow overflow-y-auto pr-2">
          <Section title="1. Setup & Activation">
            <p>There's no complex installation needed. To get started, just activate your assistant (by saying "Hey Google" or opening the app) and say the magic words:</p>
            <Command>Hey Google, talk to JEE Scheduler Pro</Command>
          </Section>

          <Section title="2. Example Commands">
            <p>Once you've started the conversation, you can say things like:</p>
            <ul className="space-y-2 list-disc list-inside pl-2">
              <li>Schedule a Physics deep dive for tomorrow at 7 PM on Rotational Dynamics.</li>
              <li>Log my test score of 210 out of 300 with mistakes in Stereoisomerism.</li>
              <li>Create a homework for Chemistry P-Block elements for Friday.</li>
            </ul>
          </Section>

          <Section title="3. One-Shot Commands">
            <p>You can also do it all in one go:</p>
            <Command>Hey Google, ask JEE Scheduler Pro to schedule a chemistry practice session for tomorrow at 8 PM.</Command>
          </Section>

          <Section title="4. Using with the Gemini App">
            <p>Yes! This integration works with the Gemini app on Android. If Gemini is your default assistant, you can use the same commands. For example:</p>
            <Command>Ask JEE Scheduler Pro to create homework for physics on circular motion for this Wednesday.</Command>
            <p className="text-xs text-gray-500 mt-2">Gemini will understand and pass the request to Google Assistant to complete the action.</p>
          </Section>

          <Section title="5. How It Works: The Web 'App Action'">
            <p>Our voice integration works using a powerful web-based equivalent of native Android App Actions.</p>
            <ol className="list-decimal list-inside space-y-2 mt-2 pl-2">
              <li>When you speak, Google Assistant/Gemini sends the text to our secure AI backend.</li>
              <li>Our backend uses the Gemini API to understand your intent (e.g., 'create a schedule') and extracts the details (topic, date, time).</li>
              <li>The AI then constructs a special URL, called a 'deep link', like: <br/> <code className="text-xs bg-gray-800 p-1 rounded">/action=new_schedule&data=...</code></li>
              <li>Google Assistant opens this link, which launches our PWA and passes the data directly to it.</li>
              <li>The app reads the 'action' and 'data' from the URL and automatically opens the correct screen with all the information pre-filled for you.</li>
            </ol>
             <p className="text-xs text-gray-500 mt-2">So, while native Android apps define voice capabilities in an XML file, our PWA declares its capabilities through this secure, URL-based deep linking system.</p>
          </Section>

        </main>
        
        <footer className="flex-shrink-0 flex justify-end gap-4 pt-4 mt-4 border-t border-gray-700/50">
          <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600">Close</button>
        </footer>
      </div>
    </div>
  );
};

export default GoogleAssistantGuideModal;