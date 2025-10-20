import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ADMIN_NAV_LINKS, LogoutIcon } from '../../constants';

const Sidebar: React.FC = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <aside className="w-64 bg-light-card dark:bg-dark-card flex-shrink-0 border-r border-light-border dark:border-dark-border p-4 flex flex-col">
      <div className="text-2xl font-bold mb-8 h-[36px] flex items-center">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-cyan-400">
            PredictiveOps
        </span>
      </div>
      <nav className="flex-1">
        <ul>
          {ADMIN_NAV_LINKS.map((link) => (
            <li key={link.text}>
              <NavLink
                to={link.href}
                className={({ isActive }) =>
                  `flex items-center p-3 my-1 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-light-accent/10 text-light-accent dark:bg-dark-accent/10 dark:text-dark-accent font-semibold'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800/60'
                  }`
                }
              >
                <link.icon className="w-6 h-6 mr-3" />
                <span>{link.text}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto">
        <button
          onClick={handleLogout}
          className="flex items-center w-full p-3 my-2 rounded-lg transition-colors text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 dark:hover:text-red-400"
        >
          <LogoutIcon className="w-6 h-6 mr-3" />
          <span className="font-medium">Logout</span>
        </button>
        <div className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
          &copy; 2025 PredictiveOps
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;