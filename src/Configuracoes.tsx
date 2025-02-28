// src/pages/Configuracoes.tsx
import Header from "@/components/Header";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

const Configuracoes = () => {
  const { toast } = useToast();
  const [temaEscuro, setTemaEscuro] = useState(false);
  const [notificacoesEmail, setNotificacoesEmail] = useState(true);
  const [loading, setLoading] = useState(false);

  const salvarConfiguracoes = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Aqui vou implementar a lógica para salvar as configurações
      // Por exemplo, em um banco de dados ou no localStorage
      
      // Exemplo com localStorage
      localStorage.setItem('preferencias', JSON.stringify({
        temaEscuro,
        notificacoesEmail
      }));

      toast({
        title: "Sucesso",
        description: "Configurações salvas com sucesso",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao salvar as configurações",
        variant: "destructive"
      });
      console.error("Erro ao salvar configurações:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="p-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">Configurações</h1>
            
            <form onSubmit={salvarConfiguracoes} className="space-y-6">
              <div>
                <h2 className="text-lg font-medium mb-4">Aparência</h2>
                <div className="flex items-center">
                  <input
                    id="temaEscuro"
                    type="checkbox"
                    checked={temaEscuro}
                    onChange={(e) => setTemaEscuro(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="temaEscuro" className="ml-2 block text-sm text-gray-900">
                    Usar tema escuro
                  </label>
                </div>
              </div>
              
              <div>
                <h2 className="text-lg font-medium mb-4">Notificações</h2>
                <div className="flex items-center">
                  <input
                    id="notificacoesEmail"
                    type="checkbox"
                    checked={notificacoesEmail}
                    onChange={(e) => setNotificacoesEmail(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="notificacoesEmail" className="ml-2 block text-sm text-gray-900">
                    Receber notificações por email
                  </label>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar Configurações"}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Configuracoes;
