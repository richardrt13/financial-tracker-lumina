type EventCallback = () => void;

class TransactionEventService {
  private listeners: EventCallback[] = [];

  // Registrar um ouvinte para eventos de transação
  subscribe(callback: EventCallback): () => void {
    this.listeners.push(callback);
    
    // Retorna uma função para cancelar a inscrição
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notificar todos os ouvintes sobre uma mudança
  notify(): void {
    this.listeners.forEach(listener => listener());
  }
}

// Exporta uma instância singleton do serviço
export const transactionEvents = new TransactionEventService();
