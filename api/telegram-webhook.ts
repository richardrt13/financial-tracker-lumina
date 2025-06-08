import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { months } from '../src/components/constants'; // Reutilizando constantes do frontend

// Interfaces para a estrutura de dados do Telegram
interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
  chat: {
    id: number;
    first_name: string;
    username: string;
    type: 'private';
  };
  date: number;
  text?: string;
  // Adicionar suporte para áudio no futuro
  // voice?: {
  //   file_id: string;
  //   duration: number;
  //   mime_type: string;
  //   file_size: number;
  // };
}

interface TelegramPayload {
  update_id: number;
  message?: TelegramMessage;
}

// Inicializar clientes com variáveis de ambiente
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY!;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genai = new GoogleGenerativeAI(geminiApiKey);

// Função para enviar uma mensagem de volta para o Telegram
async function sendTelegramMessage(chat_id: number, text: string) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
  });
}

// Função para extrair dados da transação usando Gemini
async function extractTransaction(text: string): Promise<any> {
  const model = genai.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const currentYear = new Date().getFullYear();
  const currentMonthName = months[new Date().getMonth()];

  const prompt = `
    Analise o texto a seguir para extrair uma transação financeira: "${text}".
    Retorne APENAS um objeto JSON com os campos: type, category, amount, description, month, year.
    - 'type' deve ser 'receita', 'despesa' ou 'investimento'.
    - 'category' deve ser uma categoria adequada.
    - 'amount' deve ser um número.
    - 'description' é a descrição completa.
    - 'month' é o nome do mês em português (Ex: "Junho"). Se não especificado, use "${currentMonthName}".
    - 'year' é o ano com 4 dígitos. Se não especificado, use "${currentYear}".
    
    Exemplo de saída:
    { "type": "despesa", "category": "Alimentação", "amount": 55.40, "description": "Lanche no iFood", "month": "${currentMonthName}", "year": "${currentYear}" }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().replace(/^```json\s*|```\s*$/g, '');
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Erro na API Gemini:', error);
    return null;
  }
}

// O handler principal da Vercel Function
export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Verificação de segurança simples
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return response.status(401).send('Unauthorized');
  }

  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  const payload: TelegramPayload = request.body;
  const message = payload.message;

  if (!message || !message.text) {
    // Responde a webhooks que não contêm uma mensagem de texto
    return response.status(200).send('OK');
  }

  const { chat, text } = message;

  // Lógica de "loading" enviando uma mensagem inicial
  await sendTelegramMessage(chat.id, 'Processando seu pedido...');

  try {
    // 1. Encontrar o usuário do seu app com base no chat_id do Telegram
    const { data: userData, error: userError } = await supabase
      .from('telegram_links') // Você precisará criar esta tabela
      .select('user_id, default_budget_id')
      .eq('chat_id', chat.id)
      .single();

    if (userError || !userData) {
      await sendTelegramMessage(chat.id, `Olá! Parece que sua conta do Telegram não está vinculada ao Spendly. Por favor, acesse o app e vincule sua conta na seção "Minha Conta".`);
      return response.status(200).send('User not linked');
    }

    const { user_id, default_budget_id } = userData;
    if (!default_budget_id) {
        await sendTelegramMessage(chat.id, `Você precisa definir um orçamento padrão no app para poder criar transações pelo Telegram.`);
        return response.status(200).send('Default budget not set');
    }

    // 2. Extrair dados da transação com a IA
    const transactionData = await extractTransaction(text);

    if (!transactionData || !transactionData.amount || !transactionData.category || !transactionData.type) {
      await sendTelegramMessage(chat.id, 'Não consegui entender os detalhes da transação. Tente novamente, por exemplo: "gastei 50 reais no iFood"');
      return response.status(200).send('AI extraction failed');
    }

    // 3. Salvar a transação no Supabase
    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user_id,
      budget_id: default_budget_id,
      year: transactionData.year,
      month: transactionData.month,
      type: transactionData.type,
      category: transactionData.category,
      amount: transactionData.amount,
      description: transactionData.description,
      is_completed: false, // Transações via bot começam como não pagas
    });

    if (insertError) {
      throw insertError;
    }

    // 4. Enviar confirmação ao usuário
    const confirmationText = `✅ Transação registrada com sucesso!\n\n*Tipo:* ${transactionData.type}\n*Categoria:* ${transactionData.category}\n*Valor:* R$ ${Number(transactionData.amount).toFixed(2)}\n*Descrição:* ${transactionData.description}`;
    await sendTelegramMessage(chat.id, confirmationText);

    return response.status(200).send('Success');
  } catch (error: any) {
    console.error('Erro no webhook do Telegram:', error);
    await sendTelegramMessage(chat.id, `Ocorreu um erro ao processar sua solicitação: ${error.message}`);
    return response.status(500).send('Internal Server Error');
  }
}
