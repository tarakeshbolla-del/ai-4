
import React from 'react';
import { useTheme } from '../../hooks/useTheme';
import { SunIcon, MoonIcon } from '../../constants';

interface HeaderProps {
  title: string;
  showAdminControls?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="py-4 px-6 md:px-8 bg-light-bg dark:bg-dark-bg border-b border-gray-200 dark:border-gray-700 shadow-sm sticky top-0 z-40">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
          {title}
        </h1>
        <div className="flex items-center space-x-4">
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-light-text dark:text-dark-text hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle theme"
            >
                {theme === 'light' ? (
                <MoonIcon className="w-6 h-6" />
                ) : (
                <SunIcon className="w-6 h-6 text-yellow-400" />
                )}
            </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
