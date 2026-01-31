import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, InlineDataPart } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error("Chave de API da Gemini não configurada. Defina VITE_GEMINI_API_KEY no arquivo .env.");
}

const genai = new GoogleGenerativeAI(API_KEY);

const textModelName = "gemini-2.5-flash-lite"; 
const textGenerativeModel = genai.getGenerativeModel({ model: textModelName });

const multimodalModelName = "gemini-2.5-flash-lite"; 
const multimodalGenerativeModel = genai.getGenerativeModel({
  model: multimodalModelName,
  safetySettings: [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  ],
});


export async function generateInsights(prompt: string): Promise<string> {
  try {
    const result = await textGenerativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Erro ao gerar conteúdo com o modelo generativo de texto:", error);
    throw new Error("Falha ao gerar insights. Tente novamente mais tarde.");
  }
}

async function fileToGenerativePart(file: File): Promise<InlineDataPart> {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (reader.result) {
        resolve((reader.result as string).split(',')[1]); 
      } else {
        reject(new Error("Falha ao ler o arquivo como Data URL."));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

export interface ExtractedTransactionData {
  date_str?: string;      
  description?: string;
  amount_str?: string;     
  type_suggestion?: 'receita' | 'despesa'; 
}


export async function extractTransactionsFromImage(
  imageFile: File
): Promise<ExtractedTransactionData[]> {
  console.log("genai.ts: Iniciando extração de transações da imagem:", imageFile.name);
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const currentYear = new Date().getFullYear();

    const prompt = `
      Você é um assistente especializado em extrair dados de extratos bancários em imagem.
      Analise a imagem fornecida e extraia todas as transações financeiras visíveis.

      Para cada transação, identifique:
      1.  A data da transação (dia e mês. Se o ano não estiver explícito, assuma o ano corrente: ${currentYear}). Formato: "DD/MM" ou "DD/MM/YYYY".
      2.  Uma descrição concisa da transação.
      3.  O valor da transação. Tente capturar o valor numérico e a formatação original (ex: "123,45", "1.234,56").
      4.  Uma sugestão do tipo de transação: "receita" (para entradas, créditos, depósitos) ou "despesa" (para saídas, débitos, pagamentos, compras).

      Ignore saldos totais, informações de cabeçalho/rodapé do extrato, e qualquer texto que não represente uma movimentação financeira individual.

      Formate a saída EXCLUSIVAMENTE como um array de objetos JSON. Cada objeto deve ter os seguintes campos:
      - "date_str": string (data extraída)
      - "description": string (descrição da transação)
      - "amount_str": string (valor como string, preservando o formato original o máximo possível, como "150,75" ou "R$ 50.00")
      - "type_suggestion": string ("receita" ou "despesa")

      Se uma transação parecer um investimento (ex: "COMPRA ACOES XPTO"), categorize como "despesa" inicialmente.
      Se um valor for claramente um débito (ex: indicado por "D", "Débito", sinal negativo, ou cor vermelha se discernível), "type_suggestion" deve ser "despesa".
      Se for um crédito (ex: "C", "Crédito", sinal positivo), "type_suggestion" deve ser "receita".
      Se a imagem estiver ilegível, for muito complexa, ou não parecer um extrato bancário, retorne um array JSON vazio: [].

      Exemplo de array de saída esperado:
      [
        { "date_str": "10/05", "description": "Pag Pix - Joao Silva", "amount_str": "50,00", "type_suggestion": "despesa" },
        { "date_str": "12/05/2024", "description": "SALDO ANTERIOR", "amount_str": "1234,56", "type_suggestion": "ignorar" },
        { "date_str": "15/05", "description": "DEPOSITO EM CHEQUE", "amount_str": "250,00", "type_suggestion": "receita" }
      ]
      Certifique-se de que o JSON é válido. Não inclua comentários ou texto fora do array JSON.
    `;

    const result = await multimodalGenerativeModel.generateContent([prompt, imagePart]);
    const response = await result.response;
    const textResponse = response.text();

    let extractedData: ExtractedTransactionData[] = [];
    try {
      const jsonMatch = textResponse.match(/(\[[\s\S]*\])/); // Tenta capturar o array JSON
      if (jsonMatch && jsonMatch[0]) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        console.warn("genai.ts: Nenhum array JSON encontrado na resposta da Gemini para o processamento da imagem.");
        toast({title:"Aviso da IA", description:"Não consegui encontrar um formato de dados esperado na análise da imagem.", variant:"default"});
      }
    } catch (parseError) {
      console.error("genai.ts: Erro ao parsear JSON da resposta da Gemini (imagem):", parseError, "Resposta bruta:", textResponse);
      toast({title:"Erro de Interpretação (IA)", description:"Houve um problema ao interpretar os dados do extrato. Tente uma imagem mais nítida ou com formato mais simples.", variant:"destructive"});
    }
    return extractedData;

  } catch (error) {
    console.error("genai.ts: Erro ao gerar transações da imagem com o modelo generativo:", error);
    throw new Error("Falha ao analisar a imagem com a IA. Verifique sua conexão ou tente novamente mais tarde.");
  }
}

export { genai, textGenerativeModel, multimodalGenerativeModel };