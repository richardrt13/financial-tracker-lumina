import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { generateText } from './ai-adapter-edge';

// --- CONFIGURAÇÃO ---
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!;
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

// --- TIPOS ---
interface FinancialContext {
  userId: string;
  chatId: number;
  username?: string;
  
  // Dados do mês atual
  currentMonth: {
    income: number;
    expense: number;
    balance: number;
    transactionCount: number;
    avgDailyExpense: number;
  };
  
  // Comparação com mês anterior
  lastMonth: {
    income: number;
    expense: number;
    balance: number;
  };
  
  // Tendências
  trends: {
    expenseGrowth: number; // %
    incomeGrowth: number; // %
    savingsRate: number; // %
  };
  
  // Categorias
  topCategories: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  
  // Alertas potenciais
  alerts: {
    budgetOverrun: boolean;
    unusualExpense: boolean;
    lowSavings: boolean;
    highCategorySpending: string | null;
  };
  
  // Histórico de mensagens proativas
  lastProactiveMessage?: number; // timestamp
  proactiveMessageCount: number; // últimas 24h
}

interface ProactiveInsight {
  priority: 'high' | 'medium' | 'low';
  category: 'alert' | 'tip' | 'celebration' | 'reminder' | 'analysis';
  message: string;
  shouldSend: boolean;
  reasoning: string;
}

// --- FUNÇÕES AUXILIARES ---

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    
    if (!response.ok) {
      console.error('Erro ao enviar mensagem Telegram:', await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Falha de rede (Telegram):', error);
    return false;
  }
}

async function getFinancialContext(userId: string, chatId: number): Promise<FinancialContext | null> {
  try {
    const now = new Date();
    const currentMonth = {
      start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      end: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
    };
    
    const lastMonth = {
      start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0],
      end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0],
    };

    // Buscar transações do mês atual
    const { data: currentTxs } = await supabase
      .from('transactions')
      .select('type, amount, category, date')
      .eq('user_id', userId)
      .gte('date', currentMonth.start)
      .lte('date', currentMonth.end);

    // Buscar transações do mês anterior
    const { data: lastTxs } = await supabase
      .from('transactions')
      .select('type, amount, category, date')
      .eq('user_id', userId)
      .gte('date', lastMonth.start)
      .lte('date', lastMonth.end);

    if (!currentTxs) return null;

    // Calcular métricas do mês atual
    const currentIncome = currentTxs.filter(t => t.type === 'receita').reduce((sum, t) => sum + Number(t.amount), 0);
    const currentExpense = currentTxs.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Number(t.amount), 0);
    const currentBalance = currentIncome - currentExpense;
    
    // Calcular métricas do mês anterior
    const lastIncome = lastTxs?.filter(t => t.type === 'receita').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const lastExpense = lastTxs?.filter(t => t.type === 'despesa').reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const lastBalance = lastIncome - lastExpense;

    // Tendências
    const expenseGrowth = lastExpense > 0 ? ((currentExpense - lastExpense) / lastExpense) * 100 : 0;
    const incomeGrowth = lastIncome > 0 ? ((currentIncome - lastIncome) / lastIncome) * 100 : 0;
    const savingsRate = currentIncome > 0 ? (currentBalance / currentIncome) * 100 : 0;

    // Top categorias
    const categoryTotals: Record<string, number> = {};
    currentTxs.filter(t => t.type === 'despesa').forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + Number(t.amount);
    });
    
    const topCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: currentExpense > 0 ? (amount / currentExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Alertas
    const alerts = {
      budgetOverrun: currentExpense > currentIncome,
      unusualExpense: expenseGrowth > 30, // Aumento de 30%+
      lowSavings: savingsRate < 10 && currentIncome > 0,
      highCategorySpending: topCategories[0]?.percentage > 40 ? topCategories[0].category : null,
    };

    // Histórico de mensagens proativas
    const lastMessageKey = `proactive_last:${userId}`;
    const countKey = `proactive_count:${userId}`;
    
    const lastProactiveMessage = await redis.get(lastMessageKey) as number | null;
    const proactiveMessageCount = (await redis.get(countKey) as number) || 0;

    // Dias desde o início do mês
    const daysInMonth = now.getDate();
    const avgDailyExpense = daysInMonth > 0 ? currentExpense / daysInMonth : 0;

    return {
      userId,
      chatId,
      currentMonth: {
        income: currentIncome,
        expense: currentExpense,
        balance: currentBalance,
        transactionCount: currentTxs.length,
        avgDailyExpense,
      },
      lastMonth: {
        income: lastIncome,
        expense: lastExpense,
        balance: lastBalance,
      },
      trends: {
        expenseGrowth,
        incomeGrowth,
        savingsRate,
      },
      topCategories,
      alerts,
      lastProactiveMessage: lastProactiveMessage || undefined,
      proactiveMessageCount,
    };
  } catch (error) {
    console.error('Erro ao buscar contexto financeiro:', error);
    return null;
  }
}

async function generateProactiveInsight(context: FinancialContext): Promise<ProactiveInsight | null> {
  try {
    const now = Date.now();
    const hoursSinceLastMessage = context.lastProactiveMessage 
      ? (now - context.lastProactiveMessage) / (1000 * 60 * 60)
      : 24;

    // Regras de throttling
    if (hoursSinceLastMessage < 6) {
      // Não enviar se última mensagem foi há menos de 6 horas
      return null;
    }

    if (context.proactiveMessageCount >= 3) {
      // Máximo 3 mensagens proativas por dia
      return null;
    }

    // Montar contexto para a IA
    const prompt = `
Você é Spendly, um assistente financeiro profissional via Telegram. Analise a situação financeira do usuário e decida se deve enviar uma mensagem proativa.

**CONTEXTO FINANCEIRO:**

**Mês Atual:**
- Receitas: R$ ${context.currentMonth.income.toFixed(2)}
- Despesas: R$ ${context.currentMonth.expense.toFixed(2)}
- Saldo: R$ ${context.currentMonth.balance.toFixed(2)}
- Transações: ${context.currentMonth.transactionCount}
- Gasto médio diário: R$ ${context.currentMonth.avgDailyExpense.toFixed(2)}

**Mês Anterior:**
- Receitas: R$ ${context.lastMonth.income.toFixed(2)}
- Despesas: R$ ${context.lastMonth.expense.toFixed(2)}
- Saldo: R$ ${context.lastMonth.balance.toFixed(2)}

**Tendências:**
- Crescimento de despesas: ${context.trends.expenseGrowth.toFixed(1)}%
- Crescimento de receitas: ${context.trends.incomeGrowth.toFixed(1)}%
- Taxa de economia: ${context.trends.savingsRate.toFixed(1)}%

**Top Categorias de Gasto:**
${context.topCategories.map(c => `- ${c.category}: R$ ${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}%)`).join('\n')}

**Alertas Identificados:**
- Gastos > Receitas: ${context.alerts.budgetOverrun ? 'SIM ⚠️' : 'Não'}
- Despesas aumentaram 30%+: ${context.alerts.unusualExpense ? 'SIM ⚠️' : 'Não'}
- Taxa economia < 10%: ${context.alerts.lowSavings ? 'SIM ⚠️' : 'Não'}
- Categoria dominante (>40%): ${context.alerts.highCategorySpending || 'Não'}

**Contexto de Mensagens:**
- Última mensagem proativa: ${context.lastProactiveMessage ? `há ${hoursSinceLastMessage.toFixed(1)}h` : 'nunca'}
- Mensagens hoje: ${context.proactiveMessageCount}/3

---

**SUA MISSÃO:**

Analise CRITICAMENTE se vale a pena enviar uma mensagem proativa agora. Considere:

1. **Relevância**: O insight é útil e acionável?
2. **Urgência**: Há algo que precisa de atenção imediata?
3. **Valor**: O usuário vai se beneficiar desta informação agora?
4. **Timing**: É o momento certo (hora do dia, contexto)?
5. **Novidade**: É algo que o usuário não sabe ou precisa ser lembrado?

**CRITÉRIOS PARA ENVIAR:**
- ✅ Alertas críticos (gastos > receitas, aumento brusco)
- ✅ Oportunidades claras de economia
- ✅ Celebrações (meta atingida, economia recorde)
- ✅ Lembretes importantes (final do mês, padrões)
- ❌ Informações triviais ou óbvias
- ❌ Spam (já enviou mensagem recente sobre o mesmo)

**HORA ATUAL:** ${new Date().getHours()}h (considere se é horário apropriado)

---

**RESPONDA EM JSON:**

{
  "shouldSend": true/false,
  "priority": "high" | "medium" | "low",
  "category": "alert" | "tip" | "celebration" | "reminder" | "analysis",
  "message": "Mensagem em português, 2-3 linhas, tom profissional e objetivo. Use NO MÁXIMO 2 emojis.",
  "reasoning": "Por que decidiu enviar (ou não enviar)"
}

**EXEMPLOS DE BOAS MENSAGENS:**

✅ "⚠️ Suas despesas ultrapassaram suas receitas este mês em R$ 500. Recomendo revisar os gastos em Alimentação, que representam 35% do total."

✅ "Identifiquei que você gasta R$ 300/mês em Transporte. Substituindo 30% das viagens por alternativas, você pode economizar R$ 100/mês."

✅ "Parabéns! Sua taxa de economia está em 25% este mês. Mantendo esse ritmo, você acumulará R$ 3.000 até dezembro."

❌ "Você tem 15 transações este mês 😊💰📊" (informação trivial + excesso de emojis)

❌ "Suas despesas são R$ 1.234,56 🤑" (sem contexto ou ação)
`;

    const response = await generateText(prompt, 'complex', 0.7, 600);
    const responseText = response.content.trim();
    
    // Extrair JSON
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Resposta da IA não contém JSON válido');
      return null;
    }

    const insight: ProactiveInsight = JSON.parse(jsonMatch[0]);
    
    // Validar resposta
    if (!insight.shouldSend) {
      console.log(`[${context.userId}] Agente decidiu NÃO enviar: ${insight.reasoning}`);
      return null;
    }

    return insight;
  } catch (error) {
    console.error('Erro ao gerar insight proativo:', error);
    return null;
  }
}

async function markMessageSent(userId: string) {
  try {
    const now = Date.now();
    const lastMessageKey = `proactive_last:${userId}`;
    const countKey = `proactive_count:${userId}`;
    
    // Atualizar timestamp da última mensagem
    await redis.set(lastMessageKey, now, { ex: 86400 }); // Expira em 24h
    
    // Incrementar contador (reseta à meia-noite)
    const count = (await redis.get(countKey) as number) || 0;
    
    // Calcular segundos até meia-noite
    const now_date = new Date();
    const midnight = new Date(now_date);
    midnight.setHours(24, 0, 0, 0);
    const secondsUntilMidnight = Math.floor((midnight.getTime() - now_date.getTime()) / 1000);
    
    await redis.set(countKey, count + 1, { ex: secondsUntilMidnight });
  } catch (error) {
    console.error('Erro ao marcar mensagem enviada:', error);
  }
}

// --- HANDLER PRINCIPAL ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Autenticação (cron secret OU requisição do Vercel Cron)
  const authHeader = req.headers.authorization;
  const isVercelCron = req.headers['user-agent']?.includes('vercel-cron') || 
                       req.headers['x-vercel-cron'] === '1';
  
  // Permitir se vier do Vercel Cron OU se tiver o Bearer token correto
  if (!isVercelCron && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      hint: 'Use Authorization: Bearer <CRON_SECRET> header or run via Vercel Cron'
    });
  }

  try {
    console.log('🤖 Agente proativo iniciado:', new Date().toISOString());

    // 🔥 KEEP-ALIVE: Ping nos serviços para evitar sleep/archive
    console.log('⚡ Executando keep-alive nos serviços...');
    
    // Ping Supabase (query simples)
    await supabase.from('telegram_links').select('count', { count: 'exact', head: true });
    
    // Ping Redis (get simples)
    await redis.get('keep_alive_ping');
    
    console.log('✅ Keep-alive executado');

    // Buscar todos os usuários com Telegram vinculado
    const { data: telegramLinks, error: linksError } = await supabase
      .from('telegram_links')
      .select('user_id, chat_id, username');

    if (linksError) {
      console.error('❌ Erro ao buscar telegram_links:', linksError);
      return res.status(500).json({ error: 'Database error', details: linksError });
    }

    if (!telegramLinks || telegramLinks.length === 0) {
      console.log('⚠️ Nenhum usuário com Telegram vinculado encontrado');
      return res.json({ message: 'Nenhum usuário com Telegram vinculado', sent: 0 });
    }

    console.log(`📱 Processando ${telegramLinks.length} usuários...`);

    let sentCount = 0;
    const results: any[] = [];

    for (const link of telegramLinks) {
      try {
        console.log(`🔄 Processando usuário ${link.user_id} (chat: ${link.chat_id})...`);
        
        // 1. Buscar contexto financeiro
        const context = await getFinancialContext(link.user_id, link.chat_id);
        if (!context) {
          console.log(`⚠️ [${link.user_id}] Contexto não disponível`);
          results.push({
            userId: link.user_id,
            skipped: true,
            reason: 'no_context'
          });
          continue;
        }

        console.log(`✅ [${link.user_id}] Contexto obtido - Despesas: R$ ${context.currentMonth.expense.toFixed(2)}`);

        // 2. Gerar insight com IA
        const insight = await generateProactiveInsight(context);
        if (!insight) {
          console.log(`⚠️ [${link.user_id}] Nenhum insight gerado (IA decidiu não enviar)`);
          results.push({
            userId: link.user_id,
            skipped: true,
            reason: 'no_insight'
          });
          continue;
        }

        console.log(`💡 [${link.user_id}] Insight gerado: ${insight.category}/${insight.priority} - "${insight.message.substring(0, 50)}..."`);

        // 3. Enviar mensagem
        const sent = await sendTelegramMessage(context.chatId, insight.message);
        
        if (sent) {
          // 4. Marcar como enviado
          await markMessageSent(link.user_id);
          sentCount++;
          
          results.push({
            userId: link.user_id,
            chatId: link.chat_id,
            priority: insight.priority,
            category: insight.category,
            sent: true,
            reasoning: insight.reasoning,
          });
          
          console.log(`✅ [${link.user_id}] Mensagem enviada com sucesso (${insight.category}/${insight.priority})`);
        } else {
          console.error(`❌ [${link.user_id}] Falha ao enviar mensagem ao Telegram`);
          results.push({
            userId: link.user_id,
            sent: false,
            reason: 'telegram_send_failed'
          });
        }
      } catch (userError) {
        console.error(`❌ Erro ao processar usuário ${link.user_id}:`, userError);
        results.push({
          userId: link.user_id,
          error: String(userError),
        });
      }
    }

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      usersProcessed: telegramLinks.length,
      messagesSent: sentCount,
      results,
    });
  } catch (error) {
    console.error('❌ Erro no agente proativo:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: String(error),
    });
  }
}
