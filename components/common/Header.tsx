import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { SunIcon, MoonIcon, AdminIcon } from '../../constants';

interface HeaderProps {
  title: string;
  showAdminLink?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, showAdminLink }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="py-3 px-6 md:px-8 bg-light-card/80 dark:bg-dark-card/80 backdrop-blur-lg border-b border-light-border dark:border-dark-border sticky top-0 z-40">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-light-text dark:text-dark-text tracking-tight">
          {title}
        </h1>
        <div className="flex items-center space-x-4">
            {showAdminLink && (
              <Link
                to="/admin"
                className="flex items-center p-2 rounded-full text-light-text/70 dark:text-dark-text/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Admin Panel"
                title="Admin Panel"
              >
                <AdminIcon className="w-6 h-6" />
              </Link>
            )}
            <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-light-text/70 dark:text-dark-text/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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