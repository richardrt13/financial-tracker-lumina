/**
 * CacheService - Sistema de cache em memória para respostas rápidas
 */

interface CacheEntry {
  key: string;
  value: any;
  timestamp: number;
  expiresIn: number; // em milissegundos
}

export class CacheService {
  private static cache = new Map<string, CacheEntry>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

  /**
   * Armazena um valor no cache
   */
  static set(key: string, value: any, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      expiresIn: ttl
    });
  }

  /**
   * Recupera um valor do cache
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Verificar se expirou
    if (Date.now() - entry.timestamp > entry.expiresIn) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Remove um valor do cache
   */
  static delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Limpa todo o cache
   */
  static clear(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas expiradas
   */
  static cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.expiresIn) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Gera chave de cache para contexto de usuário
   */
  static userContextKey(userId: string): string {
    return `user_context:${userId}`;
  }

  /**
   * Gera chave de cache para query específica
   */
  static queryKey(userId: string, query: string): string {
    const hash = this.simpleHash(query);
    return `query:${userId}:${hash}`;
  }

  /**
   * Hash simples para queries
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Limpar cache a cada 10 minutos
if (typeof window !== 'undefined') {
  setInterval(() => CacheService.cleanup(), 10 * 60 * 1000);
}
