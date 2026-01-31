/**
 * AI Adapter para Edge Runtime (Vercel)
 * Versão sem imports locais, tudo inline
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
  runtime: 'edge',
};

// --- TIPOS ---
export type TaskComplexity = 'simple' | 'medium' | 'complex';

// --- CONFIGURAÇÃO ---
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '');

// --- FUNÇÕES PRINCIPAIS ---

/**
 * Gera resposta de texto usando Groq (rápido) ou Gemini (fallback)
 */
export async function generateText(
  prompt: string,
  complexity: TaskComplexity = 'simple',
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<{ content: string; model: string }> {
  const startTime = Date.now();

  try {
    // Selecionar modelo baseado em complexidade
    const model = complexity === 'complex' 
      ? 'llama-3.3-70b-versatile'  // Análises profundas (1K/dia)
      : 'llama-3.1-8b-instant';    // Rápido (14.4K/dia)

    console.log(`[AI] Usando Groq ${model} para texto`);

    const completion = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    const content = completion.choices[0]?.message?.content || '';
    const latency = Date.now() - startTime;

    console.log(`[AI] Groq respondeu em ${latency}ms`);

    return { content, model };
  } catch (error: any) {
    console.error('[AI] Erro no Groq, usando fallback Gemini:', error.message);

    // Fallback para Gemini
    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });

    const result = await model.generateContent(prompt);
    const content = result.response.text();
    const latency = Date.now() - startTime;

    console.log(`[AI] Gemini fallback respondeu em ${latency}ms`);

    return { content, model: 'gemini-2.5-flash-lite-fallback' };
  }
}

/**
 * Transcreve áudio usando Whisper do Groq
 */
export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  mimeType: string
): Promise<{ content: string; model: string }> {
  try {
    console.log(`[AI] Transcrevendo áudio com Whisper (${mimeType})`);

    // Converter ArrayBuffer para Blob e depois File
    const blob = new Blob([audioBuffer], { type: mimeType });
    const file = new File([blob], 'audio.ogg', { type: mimeType });

    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      response_format: 'text',
      language: 'pt',
    });

    const content = typeof transcription === 'string' ? transcription : transcription.text;

    console.log(`[AI] Whisper transcreveu: "${content.substring(0, 50)}..."`);

    return { content, model: 'whisper-large-v3' };
  } catch (error: any) {
    console.error('[AI] Erro no Whisper:', error.message);
    throw new Error(`Falha na transcrição de áudio: ${error.message}`);
  }
}

/**
 * Analisa imagem usando Gemini (melhor visão)
 */
export async function analyzeImage(
  prompt: string,
  imageBase64: string,
  mimeType: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<{ content: string; model: string }> {
  try {
    console.log(`[AI] Analisando imagem com Gemini (${mimeType})`);

    const model = genai.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    });

    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const content = result.response.text();

    console.log(`[AI] Gemini analisou imagem: "${content.substring(0, 50)}..."`);

    return { content, model: 'gemini-2.5-flash-lite' };
  } catch (error: any) {
    console.error('[AI] Erro na análise de imagem:', error.message);
    throw new Error(`Falha na análise de imagem: ${error.message}`);
  }
}
