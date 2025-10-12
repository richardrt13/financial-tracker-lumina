type EventCallback = () => void;

class TransactionEventService {
  private listeners: EventCallback[] = [];

  subscribe(callback: EventCallback): () => void {
    this.listeners.push(callback);
    
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  notify(): void {
    this.listeners.forEach(listener => listener());
  }
}

export const transactionEvents = new TransactionEventService();
