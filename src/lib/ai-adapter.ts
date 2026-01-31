/**
 * AI Adapter - Sistema híbrido Groq + Gemini
 * 
 * Estratégia:
 * - Groq (llama-3.1-8b-instant): Chat rápido, análises simples (14.4K/dia)
 * - Groq (llama-3.3-70b-versatile): Análises complexas (1K/dia)
 * - Groq (whisper-large-v3): Transcrição de áudio (2K/dia)
 * - Gemini (2.5-flash-lite): Análise de imagens, fallback (1.5M tokens/dia)
 */

import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- CONFIGURAÇÃO ---
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || '',
});

const genai = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY || '');

// --- TIPOS ---
export type TaskComplexity = 'simple' | 'medium' | 'complex';
export type TaskType = 'text' | 'audio' | 'image';

export interface AIRequest {
  prompt: string;
  type: TaskType;
  complexity?: TaskComplexity;
  temperature?: number;
  maxTokens?: number;
  imageData?: {
    data: string; // base64
    mimeType: string;
  };
  audioData?: {
    buffer: Buffer;
    mimeType: string;
  };
}

export interface AIResponse {
  content: string;
  model: string;
  tokensUsed?: number;
  latencyMs: number;
}

// --- SELETOR DE MODELO ---
function selectModel(request: AIRequest): string {
  // Áudio sempre usa Whisper
  if (request.type === 'audio') {
    return 'whisper-large-v3';
  }

  // Imagens sempre usam Gemini (melhor visão)
  if (request.type === 'image') {
    return 'gemini-2.5-flash-lite';
  }

  // Texto: baseado em complexidade
  if (request.complexity === 'complex') {
    return 'llama-3.3-70b-versatile'; // Análises profundas
  }

  // Default: rápido e eficiente
  return 'llama-3.1-8b-instant';
}

// --- ADAPTADORES ---

async function groqTextCompletion(
  prompt: string,
  model: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<{ content: string; tokensUsed: number }> {
  const completion = await groq.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    tokensUsed: completion.usage?.total_tokens || 0,
  };
}

async function groqAudioTranscription(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  // Converter Buffer para Blob
  const blob = new Blob([buffer], { type: mimeType });
  const file = new File([blob], 'audio.ogg', { type: mimeType });

  const transcription = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    response_format: 'text',
    language: 'pt',
  });

  return typeof transcription === 'string' ? transcription : transcription.text;
}

async function geminiImageAnalysis(
  prompt: string,
  imageData: string,
  mimeType: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<{ content: string; tokensUsed: number }> {
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const imagePart = {
    inlineData: {
      data: imageData,
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const response = result.response;

  return {
    content: response.text(),
    tokensUsed: 0, // Gemini não retorna uso de tokens facilmente
  };
}

async function geminiTextCompletion(
  prompt: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<{ content: string; tokensUsed: number }> {
  const model = genai.getGenerativeModel({
    model: 'gemini-2.5-flash-lite',
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;

  return {
    content: response.text(),
    tokensUsed: 0,
  };
}

// --- API PRINCIPAL ---

export async function generateAIResponse(request: AIRequest): Promise<AIResponse> {
  const startTime = Date.now();

  try {
    const selectedModel = selectModel(request);
    console.log(`[AI Adapter] Usando modelo: ${selectedModel}`);

    let content: string;
    let tokensUsed = 0;

    // Roteamento por modelo
    if (selectedModel === 'whisper-large-v3') {
      if (!request.audioData) {
        throw new Error('audioData é obrigatório para transcrição');
      }
      content = await groqAudioTranscription(
        request.audioData.buffer,
        request.audioData.mimeType
      );
    } else if (selectedModel === 'gemini-2.5-flash-lite') {
      if (request.imageData) {
        const result = await geminiImageAnalysis(
          request.prompt,
          request.imageData.data,
          request.imageData.mimeType,
          request.temperature,
          request.maxTokens
        );
        content = result.content;
        tokensUsed = result.tokensUsed;
      } else {
        // Fallback texto no Gemini
        const result = await geminiTextCompletion(
          request.prompt,
          request.temperature,
          request.maxTokens
        );
        content = result.content;
        tokensUsed = result.tokensUsed;
      }
    } else {
      // Groq (llama-3.1-8b ou llama-3.3-70b)
      const result = await groqTextCompletion(
        request.prompt,
        selectedModel,
        request.temperature,
        request.maxTokens
      );
      content = result.content;
      tokensUsed = result.tokensUsed;
    }

    const latencyMs = Date.now() - startTime;

    return {
      content,
      model: selectedModel,
      tokensUsed,
      latencyMs,
    };
  } catch (error: any) {
    console.error('[AI Adapter] Erro:', error);

    // Fallback para Gemini em caso de erro
    if (request.type === 'text') {
      console.log('[AI Adapter] Tentando fallback para Gemini...');
      const result = await geminiTextCompletion(
        request.prompt,
        request.temperature,
        request.maxTokens
      );
      return {
        content: result.content,
        model: 'gemini-2.5-flash-lite-fallback',
        tokensUsed: result.tokensUsed,
        latencyMs: Date.now() - startTime,
      };
    }

    throw error;
  }
}

// --- FUNÇÕES DE CONVENIÊNCIA ---

export async function generateText(
  prompt: string,
  complexity: TaskComplexity = 'simple',
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<AIResponse> {
  return generateAIResponse({
    prompt,
    type: 'text',
    complexity,
    temperature,
    maxTokens,
  });
}

export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string
): Promise<AIResponse> {
  return generateAIResponse({
    prompt: '', // Não usado para áudio
    type: 'audio',
    audioData: { buffer, mimeType },
  });
}

export async function analyzeImage(
  prompt: string,
  imageData: string,
  mimeType: string,
  temperature: number = 0.7,
  maxTokens: number = 500
): Promise<AIResponse> {
  return generateAIResponse({
    prompt,
    type: 'image',
    imageData: { data: imageData, mimeType },
    temperature,
    maxTokens,
  });
}

// --- ESTATÍSTICAS (para monitoramento) ---
export interface AIStats {
  groqFastCount: number;
  groqComplexCount: number;
  whisperCount: number;
  geminiCount: number;
}

let stats: AIStats = {
  groqFastCount: 0,
  groqComplexCount: 0,
  whisperCount: 0,
  geminiCount: 0,
};

export function getAIStats(): AIStats {
  return { ...stats };
}

export function resetAIStats() {
  stats = {
    groqFastCount: 0,
    groqComplexCount: 0,
    whisperCount: 0,
    geminiCount: 0,
  };
}
