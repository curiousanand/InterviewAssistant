'use client';

import React, { useState, useEffect, useRef } from 'react';

/**
 * LanguageSelector - Provides language selection UI
 * 
 * Why: Enables multilingual functionality with intuitive selection
 * Pattern: Presentational Component - handles language selection UI
 * Rationale: Users need easy access to language settings for transcription and responses
 */

interface Language {
  code: string;
  name: string;
  nativeName: string;
  region?: string;
  flag?: string;
  rtl?: boolean;
}

interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
  autoDetectLanguage?: boolean;
  onAutoDetectChange?: (enabled: boolean) => void;
  className?: string;
  variant?: 'dropdown' | 'list' | 'grid' | 'compact';
  showFlags?: boolean;
  showNativeNames?: boolean;
  filterByRegion?: string;
  searchable?: boolean;
  disabled?: boolean;
}

const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en-US', name: 'English (US)', nativeName: 'English', region: 'North America', flag: '🇺🇸' },
  { code: 'en-GB', name: 'English (UK)', nativeName: 'English', region: 'Europe', flag: '🇬🇧' },
  { code: 'en-AU', name: 'English (Australia)', nativeName: 'English', region: 'Oceania', flag: '🇦🇺' },
  { code: 'en-CA', name: 'English (Canada)', nativeName: 'English', region: 'North America', flag: '🇨🇦' },
  
  { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español', region: 'Europe', flag: '🇪🇸' },
  { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español', region: 'North America', flag: '🇲🇽' },
  { code: 'es-AR', name: 'Spanish (Argentina)', nativeName: 'Español', region: 'South America', flag: '🇦🇷' },
  
  { code: 'fr-FR', name: 'French (France)', nativeName: 'Français', region: 'Europe', flag: '🇫🇷' },
  { code: 'fr-CA', name: 'French (Canada)', nativeName: 'Français', region: 'North America', flag: '🇨🇦' },
  
  { code: 'de-DE', name: 'German', nativeName: 'Deutsch', region: 'Europe', flag: '🇩🇪' },
  { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', region: 'Europe', flag: '🇮🇹' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português', region: 'South America', flag: '🇧🇷' },
  { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português', region: 'Europe', flag: '🇵🇹' },
  
  { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', region: 'Asia', flag: '🇯🇵' },
  { code: 'ko-KR', name: 'Korean', nativeName: '한국어', region: 'Asia', flag: '🇰🇷' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', region: 'Asia', flag: '🇨🇳' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)', region: 'Asia', flag: '🇹🇼' },
  
  { code: 'ru-RU', name: 'Russian', nativeName: 'Русский', region: 'Europe', flag: '🇷🇺' },
  { code: 'ar-SA', name: 'Arabic', nativeName: 'العربية', region: 'Middle East', flag: '🇸🇦', rtl: true },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', region: 'Asia', flag: '🇮🇳' },
  { code: 'tr-TR', name: 'Turkish', nativeName: 'Türkçe', region: 'Europe', flag: '🇹🇷' },
  { code: 'nl-NL', name: 'Dutch', nativeName: 'Nederlands', region: 'Europe', flag: '🇳🇱' },
  { code: 'sv-SE', name: 'Swedish', nativeName: 'Svenska', region: 'Europe', flag: '🇸🇪' },
  { code: 'da-DK', name: 'Danish', nativeName: 'Dansk', region: 'Europe', flag: '🇩🇰' },
  { code: 'no-NO', name: 'Norwegian', nativeName: 'Norsk', region: 'Europe', flag: '🇳🇴' },
  { code: 'fi-FI', name: 'Finnish', nativeName: 'Suomi', region: 'Europe', flag: '🇫🇮' }
];

export function LanguageSelector({
  selectedLanguage,
  onLanguageChange,
  autoDetectLanguage = false,
  onAutoDetectChange,
  className = '',
  variant = 'dropdown',
  showFlags = true,
  showNativeNames = true,
  filterByRegion,
  searchable = false,
  disabled = false
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLanguages, setFilteredLanguages] = useState<Language[]>(SUPPORTED_LANGUAGES);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter languages based on search and region
  useEffect(() => {
    let filtered = SUPPORTED_LANGUAGES;

    if (filterByRegion) {
      filtered = filtered.filter(lang => lang.region === filterByRegion);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(lang =>
        lang.name.toLowerCase().includes(term) ||
        lang.nativeName.toLowerCase().includes(term) ||
        lang.code.toLowerCase().includes(term)
      );
    }

    setFilteredLanguages(filtered);
  }, [searchTerm, filterByRegion]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen, searchable]);

  const handleLanguageSelect = (languageCode: string) => {
    onLanguageChange(languageCode);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getSelectedLanguage = (): Language | undefined => {
    return SUPPORTED_LANGUAGES.find(lang => lang.code === selectedLanguage);
  };

  const renderLanguageOption = (language: Language, isSelected: boolean = false) => (
    <div
      key={language.code}
      className={`
        flex items-center space-x-3 px-3 py-2 cursor-pointer transition-colors
        ${isSelected 
          ? 'bg-primary text-primary-foreground' 
          : 'hover:bg-muted text-foreground'
        }
        ${language.rtl ? 'flex-row-reverse space-x-reverse' : ''}
      `}
      onClick={() => handleLanguageSelect(language.code)}
    >
      {showFlags && language.flag && (
        <span className="text-lg">{language.flag}</span>
      )}
      
      <div className="flex-1 min-w-0">
        <div className={`font-medium ${language.rtl ? 'text-right' : 'text-left'}`}>
          {language.name}
        </div>
        {showNativeNames && language.nativeName !== language.name && (
          <div className={`text-sm opacity-70 ${language.rtl ? 'text-right' : 'text-left'}`}>
            {language.nativeName}
          </div>
        )}
      </div>

      {isSelected && (
        <CheckIcon className="w-4 h-4 flex-shrink-0" />
      )}
    </div>
  );

  if (variant === 'compact') {
    const selectedLang = getSelectedLanguage();
    return (
      <div className={`relative ${className}`} ref={containerRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex items-center space-x-1 px-2 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {selectedLang?.flag && showFlags && (
            <span className="text-sm">{selectedLang.flag}</span>
          )}
          <span>{selectedLang?.code || 'Select'}</span>
          <ChevronDownIcon className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full mt-1 right-0 z-50 w-48 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filteredLanguages.map(lang => 
              renderLanguageOption(lang, lang.code === selectedLanguage)
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'dropdown') {
    const selectedLang = getSelectedLanguage();
    
    return (
      <div className={`space-y-2 ${className}`}>
        {onAutoDetectChange && (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoDetectLanguage}
              onChange={(e) => onAutoDetectChange(e.target.checked)}
              disabled={disabled}
              className="text-primary"
            />
            <span className="text-sm text-foreground">Auto-detect language</span>
          </label>
        )}

        <div className="relative" ref={containerRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || autoDetectLanguage}
            className="w-full flex items-center justify-between px-3 py-2 bg-background border border-input rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <div className="flex items-center space-x-3">
              {selectedLang?.flag && showFlags && (
                <span className="text-lg">{selectedLang.flag}</span>
              )}
              <div className="text-left">
                <div className="text-sm font-medium text-foreground">
                  {autoDetectLanguage ? 'Auto-detect' : (selectedLang?.name || 'Select language')}
                </div>
                {selectedLang && showNativeNames && !autoDetectLanguage && (
                  <div className="text-xs text-muted-foreground">
                    {selectedLang.nativeName}
                  </div>
                )}
              </div>
            </div>
            <ChevronDownIcon className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && !autoDetectLanguage && (
            <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-80 overflow-hidden">
              {searchable && (
                <div className="p-3 border-b border-border">
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search languages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              )}

              <div className="max-h-60 overflow-y-auto">
                {filteredLanguages.length === 0 ? (
                  <div className="px-3 py-4 text-center text-muted-foreground text-sm">
                    No languages found
                  </div>
                ) : (
                  filteredLanguages.map(lang => 
                    renderLanguageOption(lang, lang.code === selectedLanguage)
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`space-y-4 ${className}`}>
        {onAutoDetectChange && (
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoDetectLanguage}
              onChange={(e) => onAutoDetectChange(e.target.checked)}
              disabled={disabled}
              className="text-primary"
            />
            <span className="text-sm text-foreground">Auto-detect language</span>
          </label>
        )}

        {searchable && (
          <input
            type="text"
            placeholder="Search languages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={disabled || autoDetectLanguage}
            className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {filteredLanguages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              disabled={disabled || autoDetectLanguage}
              className={`
                p-3 border rounded-md text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                ${lang.code === selectedLanguage 
                  ? 'border-primary bg-primary/10 text-primary' 
                  : 'border-border hover:border-primary/50 hover:bg-muted'
                }
              `}
            >
              <div className="flex items-center space-x-2 mb-1">
                {showFlags && lang.flag && (
                  <span className="text-lg">{lang.flag}</span>
                )}
                <div className="text-sm font-medium text-foreground">
                  {lang.name}
                </div>
              </div>
              {showNativeNames && lang.nativeName !== lang.name && (
                <div className="text-xs text-muted-foreground">
                  {lang.nativeName}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // List variant
  return (
    <div className={`space-y-3 ${className}`}>
      {onAutoDetectChange && (
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={autoDetectLanguage}
            onChange={(e) => onAutoDetectChange(e.target.checked)}
            disabled={disabled}
            className="text-primary"
          />
          <span className="text-sm text-foreground">Auto-detect language</span>
        </label>
      )}

      {searchable && (
        <input
          type="text"
          placeholder="Search languages..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={disabled || autoDetectLanguage}
          className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
      )}

      <div className="border border-border rounded-md max-h-60 overflow-y-auto">
        {filteredLanguages.length === 0 ? (
          <div className="px-3 py-4 text-center text-muted-foreground text-sm">
            No languages found
          </div>
        ) : (
          filteredLanguages.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              disabled={disabled || autoDetectLanguage}
              className={`
                w-full text-left border-b border-border last:border-b-0 disabled:opacity-50 disabled:cursor-not-allowed
                ${lang.code === selectedLanguage 
                  ? 'bg-primary/10 text-primary' 
                  : 'hover:bg-muted text-foreground'
                }
              `}
            >
              {renderLanguageOption(lang, lang.code === selectedLanguage)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * LanguageDetectionIndicator - Shows detected language
 */
interface LanguageDetectionIndicatorProps {
  detectedLanguage?: string;
  confidence?: number;
  isDetecting?: boolean;
  className?: string;
}

export function LanguageDetectionIndicator({
  detectedLanguage,
  confidence,
  isDetecting = false,
  className = ''
}: LanguageDetectionIndicatorProps) {
  const language = SUPPORTED_LANGUAGES.find(lang => lang.code === detectedLanguage);

  if (!isDetecting && !detectedLanguage) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      {isDetecting ? (
        <>
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Detecting language...</span>
        </>
      ) : language ? (
        <>
          {language.flag && <span className="text-lg">{language.flag}</span>}
          <span className="text-foreground font-medium">{language.name}</span>
          {confidence !== undefined && (
            <span className="text-muted-foreground">
              ({Math.round(confidence * 100)}% confidence)
            </span>
          )}
        </>
      ) : (
        <span className="text-muted-foreground">Unknown language</span>
      )}
    </div>
  );
}

// Icon components
const ChevronDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);