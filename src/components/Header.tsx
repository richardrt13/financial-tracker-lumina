import { useState } from 'react';
import { Menu, User, LogOut, Settings, Moon, Sun, BarChart3, Target, Calendar, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate, useLocation } from 'react-router-dom';

function SpendlyLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="10" fill="hsl(var(--primary))" />
      <path d="M16 6C16 6 10 12 10 18C10 21.3 12.7 24 16 24C19.3 24 22 21.3 22 18C22 12 16 6 16 6Z" fill="white" opacity="0.9" />
      <path d="M16 10C16 10 13 14 13 17.5C13 19.4 14.6 21 16.5 21" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: null },
    { path: '/analytics', label: 'Analytics', icon: BarChart3 },
    { path: '/metas', label: 'Metas', icon: Target },
    { path: '/calendario', label: 'Calendário', icon: Calendar },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-card/90 glass">
      <div className="max-w-7xl mx-auto flex justify-between items-center h-16 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
            <SpendlyLogo className="h-9 w-9 transition-transform group-hover:scale-105" />
            <span className="text-xl font-bold tracking-tight">
              Spend<span className="text-primary">ly</span>
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-0.5 bg-muted/60 p-1 rounded-xl">
            {navItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
            aria-label="Alternar tema"
          >
            {resolvedTheme === 'dark'
              ? <Sun size={18} />
              : <Moon size={18} />
            }
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200"
              aria-label="Menu de usuário"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-card rounded-2xl shadow-lg border p-2 z-20 animate-slide-down">
                  <div className="px-3 py-2.5 mb-1 rounded-xl bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Conectado como</p>
                    <p className="text-sm font-medium truncate mt-0.5">{user?.email}</p>
                  </div>

                  <div className="md:hidden mb-1">
                    {navItems.map(item => (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setMenuOpen(false); }}
                        className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors ${
                          location.pathname === item.path
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        {item.icon && <item.icon size={16} />}
                        {item.label}
                      </button>
                    ))}
                    <div className="h-px bg-border my-1" />
                  </div>

                  <button
                    onClick={() => { navigate('/minha-conta'); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl hover:bg-muted/60 transition-colors"
                  >
                    <User size={16} />
                    Minha Conta
                  </button>

                  <button
                    onClick={() => { navigate('/configuracoes'); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl hover:bg-muted/60 transition-colors"
                  >
                    <Settings size={16} />
                    Configurações
                  </button>

                  <div className="h-px bg-border my-1" />

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl text-destructive hover:bg-destructive/8 transition-colors"
                  >
                    <LogOut size={16} />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
