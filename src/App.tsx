import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState, memo, ReactNode } from "react";
import { supabase } from "./lib/supabase";
import { User, Session } from "@supabase/supabase-js";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BottomNav } from "./components/BottomNav";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import MinhaConta from "./pages/MinhaConta";
import Configuracoes from "./pages/Configuracoes";
import Analytics from "./pages/Analytics";
import Metas from "./pages/Metas";
import Calendario from "./pages/Calendario";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

interface PrivateRouteProps {
  children: ReactNode;
}

function PrivateRoute({ children }: PrivateRouteProps) {
  const [session, setSession] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(!!session);
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setSession(!!session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) return null;

  return session ? (
    <AuthProvider user={user}>
      <div className="pb-16 md:pb-0">
        {children}
      </div>
      <BottomNav />
    </AuthProvider>
  ) : (
    <Navigate to="/login" replace />
  );
}

const MemoizedPrivateRoute = memo(PrivateRoute);

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MemoizedPrivateRoute><Index /></MemoizedPrivateRoute>} />
            <Route path="/analytics" element={<MemoizedPrivateRoute><Analytics /></MemoizedPrivateRoute>} />
            <Route path="/metas" element={<MemoizedPrivateRoute><Metas /></MemoizedPrivateRoute>} />
            <Route path="/calendario" element={<MemoizedPrivateRoute><Calendario /></MemoizedPrivateRoute>} />
            <Route path="/minha-conta" element={<MemoizedPrivateRoute><MinhaConta /></MemoizedPrivateRoute>} />
            <Route path="/configuracoes" element={<MemoizedPrivateRoute><Configuracoes /></MemoizedPrivateRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
