import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center animate-fade-in max-w-sm">
        <div className="text-7xl mb-4 animate-float">🔍</div>
        <h1 className="text-6xl font-bold tracking-tighter mb-2 text-primary">404</h1>
        <h2 className="text-xl font-semibold tracking-tight mb-2">Página não encontrada</h2>
        <p className="text-muted-foreground mb-8">
          A página que você procura não existe ou foi movida. Que tal voltar ao dashboard?
        </p>
        <Button asChild className="rounded-xl h-11 px-6 gap-2">
          <a href="/">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
