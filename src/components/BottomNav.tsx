import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Target, Calendar } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/metas', label: 'Metas', icon: Target },
  { path: '/calendario', label: 'Agenda', icon: Calendar },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-card/90 glass safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`relative flex flex-col items-center gap-1 py-1.5 px-4 rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground active:scale-90'
              }`}
            >
              {isActive && (
                <span className="absolute -top-2 inset-x-3 h-[3px] rounded-full bg-primary animate-scale-in" />
              )}
              <div className={`transition-all duration-300 ${isActive ? 'bg-primary/10 p-1.5 rounded-xl' : 'p-1.5'}`}>
                <item.icon className={`h-5 w-5 transition-all duration-200 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              </div>
              <span className={`text-[10px] leading-none transition-all duration-200 ${isActive ? 'font-bold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
