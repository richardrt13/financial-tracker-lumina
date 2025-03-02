import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuração da chave de API
const API_KEY = process.env.GEMINI_API_KEY; // Certifique-se de que a chave está configurada no ambiente

if (!API_KEY) {
  throw new Error("Chave de API da Gemini não configurada. Defina NEXT_PUBLIC_GEMINI_API_KEY no arquivo .env.");
}

// Inicializa o cliente da Gemini
const genai = new GoogleGenerativeAI(API_KEY);

// Configuração do modelo generativo
const modelName = "gemini-1.5-flash"; // Nome do modelo que você deseja usar
const generativeModel = genai.getGenerativeModel({ model: modelName });

// Função para gerar conteúdo com base em um prompt
export async function generateInsights(prompt: string): Promise<string> {
  try {
    // Gera o conteúdo usando o modelo
    const result = await generativeModel.generateContent(prompt);
    const response = await result.response;
    return response.text(); // Retorna o texto gerado pelo modelo
  } catch (error) {
    console.error("Erro ao gerar conteúdo com o modelo generativo:", error);
    throw new Error("Falha ao gerar insights. Tente novamente mais tarde.");
  }
}

// Exporta o cliente e o modelo para uso em outros componentes
export { genai, generativeModel };
