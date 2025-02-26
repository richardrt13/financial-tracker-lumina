
import { TransactionForm } from "@/components/TransactionForm";
import { Dashboard } from "@/components/Dashboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Gerenciamento Financeiro</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-[400px,1fr] gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Nova Transação</h2>
            <TransactionForm />
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
            <Dashboard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
