import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Language, LocalizedString } from '../types';

interface LocalizationContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (localizedString: LocalizedString) => string;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export const LocalizationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('EN');

  const t = (localizedString: LocalizedString): string => {
    return localizedString[language] || localizedString['EN'];
  };

  return (
    <LocalizationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};