const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const geminiApiKey = process.env.VITE_GEMINI_API_KEY;
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey || !telegramBotToken) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente faltando. Verifique a configuração na Vercel.");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const genai = new GoogleGenerativeAI(geminiApiKey);

async function sendTelegramMessage(chat_id, text) {
  const url = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'Markdown' }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        console.error("Erro ao enviar mensagem para o Telegram:", errorData);
    }
  } catch (error) {
      console.error("Falha de rede ao contatar a API do Telegram:", error);
  }
}

async function extractTransaction(text) {
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
    const jsonText = response.text().replace(/^```json\s*|```\s*$/g, '').trim();
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Erro na API Gemini:', error);
    return null;
  }
}

export default async function handler(request, response) {
  const secret = request.headers['x-telegram-bot-api-secret-token'];
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return response.status(401).send('Unauthorized');
  }

  if (request.method !== 'POST') {
    return response.status(405).send('Method Not Allowed');
  }

  const payload = request.body;
  const message = payload.message;

  if (!message || !message.text) {
    return response.status(200).send('OK: No text message');
  }

  const { chat, text } = message;

  try {
    const { data: userData, error: userError } = await supabase
      .from('telegram_links') 
      .select('user_id, default_budget_id')
      .eq('chat_id', chat.id)
      .single();

    if (userError || !userData) {
      await sendTelegramMessage(chat.id, `Olá! Sua conta do Telegram não está vinculada ao Spendly. Por favor, acesse o app, vá em "Minha Conta" e clique em "Vincular com Telegram".`);
      return response.status(200).send('User not linked');
    }

    const { user_id, default_budget_id } = userData;
    if (!default_budget_id) {
        await sendTelegramMessage(chat.id, `Você precisa definir um orçamento padrão no app para poder criar transações pelo Telegram.`);
        return response.status(200).send('Default budget not set');
    }

    await sendTelegramMessage(chat.id, 'Analisando seu comando...');

    const transactionData = await extractTransaction(text);

    if (!transactionData || !transactionData.amount || !transactionData.category || !transactionData.type) {
      await sendTelegramMessage(chat.id, 'Não consegui entender os detalhes da transação. Tente novamente, por exemplo: "gastei 50 reais no iFood"');
      return response.status(200).send('AI extraction failed');
    }

    const { error: insertError } = await supabase.from('transactions').insert({
      user_id: user_id,
      budget_id: default_budget_id,
      year: transactionData.year,
      month: transactionData.month,
      type: transactionData.type,
      category: transactionData.category,
      amount: transactionData.amount,
      description: transactionData.description,
      is_completed: false, 
    });

    if (insertError) {
      throw insertError;
    }

    const confirmationText = `✅ Transação registrada com sucesso!\n\n*Tipo:* ${transactionData.type}\n*Categoria:* ${transactionData.category}\n*Valor:* R$ ${Number(transactionData.amount).toFixed(2)}\n*Descrição:* ${transactionData.description}`;
    await sendTelegramMessage(chat.id, confirmationText);

    return response.status(200).send('Success');
  } catch (error) {
    console.error('Erro no webhook do Telegram:', error);
    await sendTelegramMessage(chat.id, `Ocorreu um erro ao processar sua solicitação. A equipe de suporte foi notificada.`);
    return response.status(200).send('Error processed');
  }
}
