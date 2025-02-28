// src/components/Header.tsx
import { useState } from 'react';
import { Menu, User, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };
  
  // Feche o menu quando clicar fora dele
  const handleClickOutside = () => {
    if (menuOpen) {
      setMenuOpen(false);
    }
  };
  
  const goToHome = () => {
    navigate('/');
  };
  
  return (
    //<header className="bg-white shadow-sm py-4 px-6">
    <header className="bg-[#4CAF50] shadow-sm py-4 px-6">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <h1 
          className="text-xl font-semibold text-gray-800 cursor-pointer hover:text-blue-600 transition-colors" 
          onClick={goToHome}
        >
          Spendly
        </h1>
        
        <div className="relative">
          <button 
            onClick={toggleMenu} 
            className="p-2 rounded-full hover:bg-gray-100 focus:outline-none"
            aria-label="Menu de usuário"
          >
            <Menu size={24} className="text-gray-700" />
          </button>
          
          {menuOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={handleClickOutside}
              />
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-gray-200">
                <div className="px-4 py-2 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                </div>
                
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/minha-conta');
                    setMenuOpen(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <User size={16} className="mr-2" />
                  Minha Conta
                </a>
                
                <a 
                  href="#" 
                  onClick={(e) => {
                    e.preventDefault();
                    navigate('/configuracoes');
                    setMenuOpen(false);
                  }}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Settings size={16} className="mr-2" />
                  Configurações
                </a>
                
                <button 
                  onClick={handleLogout} 
                  className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                >
                  <LogOut size={16} className="mr-2" />
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
