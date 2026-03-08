import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { months as monthNames } from './constants'; // Renomeado para evitar conflito
import { generateInsights } from '@/lib/genai'; // Ajuste o caminho se genai.ts não estiver em lib

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

type Transaction = {
  type: 'receita' | 'despesa' | 'investimento';
  category: string;
  amount: number;
  month: string;
  year: string;
  isRecurring: boolean;
  recurringMonths: string; // Deve ser a representação em string de um número, ex: "1", "12"
  dueDay: string; // Deve ser a representação em string de um número, ex: "15", ou ""
};

interface VoiceCommandTransactionProps {
  onTransactionRecognized: (transaction: Transaction) => void;
  onSubmitTransaction: (transaction: Transaction) => Promise<void>;
}

export function VoiceCommandTransaction({
  onTransactionRecognized,
  onSubmitTransaction
}: VoiceCommandTransactionProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'prompt' | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentlyListening, setCurrentlyListening] = useState(false);
  const [attemptingToStart, setAttemptingToStart] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const { toast } = useToast();

  const checkMicrophonePermission = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        
        result.onchange = () => {
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };

        return result.state;
      } else {
        return 'prompt'; 
      }
    } catch (error) {
      console.error('Erro ao verificar permissões do microfone:', error);
      return 'prompt';
    }
  };

  const setupAudioAnalyser = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de mídia não suportada neste navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      visualizeAudio();

      return true;
    } catch (error: any) {
      console.error('Erro ao configurar analisador de áudio:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setPermissionStatus('denied');
        setErrorMessage('Permissão para acessar o microfone negada.');
      } else {
        setErrorMessage(`Erro ao acessar o microfone: ${error.message}`);
      }
      return false;
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateAudioLevel = () => {
      if (!analyserRef.current || !isListening) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      
      const average = sum / bufferLength;
      const normalizedLevel = Math.min(Math.round((average / 256) * 100), 100);
      
      setAudioLevel(normalizedLevel);
      setCurrentlyListening(normalizedLevel > 5); 
      
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };

  const cleanupResources = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Erros aqui podem ser benignos se já estiver parado.
      }
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      microphoneStreamRef.current = null;
    }
    setAudioLevel(0);
    setCurrentlyListening(false);
  };


  const startListening = async () => {
    setAttemptingToStart(true);
    setErrorMessage("");
    setTranscript(""); 
    
    const permissionState = await checkMicrophonePermission();
    
    if (permissionState === 'denied') {
      setErrorMessage("Permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone nas configurações do seu navegador.");
      setAttemptingToStart(false);
      return;
    }
     if (permissionState === 'prompt' && !microphoneStreamRef.current) {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }); 
      } catch (err: any) {
         if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setPermissionStatus('denied');
          setErrorMessage("Permissão para acessar o microfone negada.");
        } else {
          setErrorMessage(`Erro ao solicitar acesso ao microfone: ${err.message}`);
        }
        setAttemptingToStart(false);
        return;
      }
    }
    
    const audioSetupSuccess = await setupAudioAnalyser();
    
    if (!audioSetupSuccess) {
      setAttemptingToStart(false);
      cleanupResources(); 
      return;
    }
    
    setIsListening(true);
    
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        toast({
          title: "Microfone ativado",
          description: "Fale seu comando de voz agora.",
        });
      }
    } catch (error: any) {
      console.error('Erro ao iniciar reconhecimento:', error);
      setErrorMessage(`Erro ao iniciar: ${error.message}`);
      cleanupResources(); 
      setIsListening(false);
    }
    
    setAttemptingToStart(false);
  };

  const stopListening = () => {
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        // Erros aqui podem ser benignos
      }
    }
  };

  const processVoiceCommand = async () => {
    // A verificação de transcript vazio é feita pelo useEffect, mas uma dupla checagem não prejudica.
    if (!transcript.trim()) {
      // Não deve chegar aqui se o useEffect estiver correto, mas por segurança:
      // cleanupResources(); // O finally do try/catch abaixo já cuidará disso.
      return;
    }

    setIsProcessing(true);
    setErrorMessage(""); // Limpa mensagens de erro anteriores

    const currentJsDate = new Date();
    const currentMonthName = monthNames[currentJsDate.getMonth()];
    const currentYearName = currentJsDate.getFullYear().toString();

    const prompt = `
      Você é um assistente inteligente para um aplicativo de finanças pessoais.
      Sua tarefa é extrair informações de transação do texto fornecido pelo usuário.
      O texto do usuário é: "${transcript}"

      Analise o texto e retorne APENAS um objeto JSON com os seguintes campos:
      - "type": string (valores possíveis: "receita", "despesa", "investimento"). Se não especificado, assuma "despesa".
      - "category": string (ex: "Alimentação", "Salário", "Ações"). Se não especificada, use "Outros".
      - "amount": number (ex: 150.75). Deve ser maior que 0. Se não encontrar um valor, use 0.
      - "month": string (nome do mês em português por extenso, ex: "Janeiro", "Fevereiro"). Se não especificado, use "${currentMonthName}".
      - "year": string (formato AAAA, ex: "2024"). Se não especificado, use "${currentYearName}".
      - "isRecurring": boolean (true se for uma transação recorrente/mensal/parcelada, false caso contrário).
      - "recurringMonths": string (número de meses da recorrência como string, ex: "3", "12"). Relevante apenas se isRecurring for true. Se isRecurring for true mas sem duração explícita, use "1". Se isRecurring for false, use "1".
      - "dueDay": string (dia do vencimento como string, ex: "15", "28"). Se não especificado, use "".

      Categorias comuns para 'despesa': "Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Contas", "Educação", "Impostos", "Outros".
      Categorias comuns para 'receita': "Salário", "Freelance", "Investimentos", "Rendimentos", "Presente", "Outros".
      Categorias comuns para 'investimento': "Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Imóveis", "Outros".

      Se o usuário mencionar "todo mês", "mensalmente", "recorrente" ou "parcelado", "isRecurring" deve ser true.
      O valor numérico do amount deve ser extraído, por exemplo, "cinquenta reais e vinte e cinco centavos" deve ser 50.25.
      Se "recurringMonths" for mencionado (ex: "por 3 meses", "durante 6 meses", "em 5 parcelas"), extraia o número de meses.
      O "dueDay" refere-se ao dia do mês para o vencimento. Se mencionado "dia dez", use "10".

      Exemplo de entrada: "Lançar despesa com supermercado de cento e cinquenta reais e setenta e cinco centavos para o dia 10 de maio de 2024, recorrente por 3 meses"
      Exemplo de saída JSON esperada:
      {
        "type": "despesa",
        "category": "Alimentação",
        "amount": 150.75,
        "month": "Maio",
        "year": "2024",
        "isRecurring": true,
        "recurringMonths": "3",
        "dueDay": "10"
      }

      Outro exemplo de entrada: "Salário de cinco mil quinhentos para julho"
      Exemplo de saída JSON esperada:
      {
        "type": "receita",
        "category": "Salário",
        "amount": 5500,
        "month": "Julho",
        "year": "${currentYearName}",
        "isRecurring": false,
        "recurringMonths": "1",
        "dueDay": ""
      }

      Texto do usuário: "${transcript}"
      Objeto JSON:
    `;

    try {
      const geminiResponse = await generateInsights(prompt);
      let transactionInfo: Partial<Transaction> = {};

      try {
        const cleanedResponse = geminiResponse.replace(/^```json\s*|```\s*$/g, '');
        transactionInfo = JSON.parse(cleanedResponse);
      } catch (e) {
        console.error("Erro ao parsear JSON da Gemini:", e, "Resposta recebida:", geminiResponse);
        toast({
          title: "Erro de Interpretação (IA)",
          description: "Não consegui entender o formato da resposta do assistente. Tente ser mais específico.",
          variant: "destructive"
        });
        setTranscript(""); // Limpa a transcrição para evitar loop com comando malformado
        return; // Permite que o bloco finally execute a limpeza
      }

      const validatedTransaction: Transaction = {
        type: ['receita', 'despesa', 'investimento'].includes(transactionInfo.type as any) ? transactionInfo.type as Transaction['type'] : 'despesa',
        category: typeof transactionInfo.category === 'string' && transactionInfo.category.trim() !== '' ? transactionInfo.category : 'Outros',
        amount: typeof transactionInfo.amount === 'number' && transactionInfo.amount > 0 ? transactionInfo.amount : 0,
        month: typeof transactionInfo.month === 'string' && monthNames.map(m => m.toLowerCase()).includes(transactionInfo.month.toLowerCase()) ? monthNames.find(m => m.toLowerCase() === transactionInfo.month!.toLowerCase())! : currentMonthName,
        year: typeof transactionInfo.year === 'string' && /^\d{4}$/.test(transactionInfo.year) ? transactionInfo.year : currentYearName,
        isRecurring: typeof transactionInfo.isRecurring === 'boolean' ? transactionInfo.isRecurring : false,
        recurringMonths: typeof transactionInfo.recurringMonths === 'string' && transactionInfo.recurringMonths.trim() !== '' ? transactionInfo.recurringMonths : "1",
        dueDay: typeof transactionInfo.dueDay === 'string' ? transactionInfo.dueDay : "",
      };
      
      if (validatedTransaction.amount <= 0) {
        toast({
          title: "Valor Inválido",
          description: "Não foi possível identificar um valor válido para a transação. O valor deve ser maior que zero.",
          variant: "destructive"
        });
        setTranscript(""); // Limpa a transcrição para evitar loop com valor inválido
        return; // Permite que o bloco finally execute a limpeza
      }
      
      onTransactionRecognized(validatedTransaction); // Popula o formulário no componente pai

      // CORREÇÃO: Ativa a submissão automática
      await onSubmitTransaction(validatedTransaction); // Chama a lógica de submissão no componente pai

      toast({
        title: "Sucesso!",
        description: `Transação adicionada: ${validatedTransaction.type}, ${validatedTransaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, Categoria: ${validatedTransaction.category}`,
      });
      
      // CORREÇÃO: Limpa a transcrição após o sucesso para evitar o loop
      setTranscript(""); 

    } catch (error: any) {
      console.error('Erro ao processar comando com IA ou submeter transação:', error);
      toast({
        title: "Erro no Processamento",
        description: error.message || "Ocorreu um erro ao processar o comando de voz ou ao adicionar a transação.",
        variant: "destructive"
      });
      // CORREÇÃO: Limpa a transcrição também em caso de erro para evitar loop com comando problemático
      setTranscript("");
    } finally {
      setIsProcessing(false);
      cleanupResources(); // Garante que os recursos do microfone sejam sempre liberados
    }
  };

  useEffect(() => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      setErrorMessage("Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    checkMicrophonePermission();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false; 
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'pt-BR';

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error);
      let specificError = `Erro no reconhecimento: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPermissionStatus('denied');
        specificError = 'Permissão para acessar o microfone negada.';
        setErrorMessage(specificError);
      } else if (event.error === 'aborted') {
        specificError = "Reconhecimento interrompido.";
        if (!attemptingToStart) {
            toast({ title: "Reconhecimento interrompido", description: "A gravação foi interrompida.", variant: "default" });
        }
      } else if (event.error === 'no-speech') {
        specificError = "Nenhuma fala detectada. Tente novamente.";
        toast({ title: "Nenhuma fala detectada", description: "Por favor, fale mais alto ou verifique seu microfone.", variant: "destructive" });
      } else {
        setErrorMessage(specificError);
      }
      setIsListening(false); 
      cleanupResources(); // Limpa recursos em caso de erro no reconhecimento
    };

    recognitionRef.current.onend = () => {
         setIsListening(false); 
         // A lógica de processamento é disparada pelo useEffect abaixo, baseado em isListening e transcript.
         // cleanupResources() é chamado pelo onerror ou pelo finally do processVoiceCommand.
    };
    
    return () => {
      cleanupResources();
      if (recognitionRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  useEffect(() => {
    let silenceTimer: NodeJS.Timeout | null = null;
    if (isListening && transcript && !currentlyListening) {
      silenceTimer = setTimeout(() => {
        if (isListening && transcript && !currentlyListening) {
          stopListening(); 
        }
      }, 2000); 
    }
    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [isListening, transcript, currentlyListening]);

  useEffect(() => {
    if (!isListening && transcript.trim() && !isProcessing) {
      processVoiceCommand();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript, isProcessing]); // transcript é uma dependência chave aqui

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-medium">Adicionar Transação por Voz (via IA)</h3>
        <p className="text-sm text-muted-foreground">
          Clique em "Iniciar gravação" e diga seu comando. Ex: "Despesa de supermercado 120 reais para hoje".
        </p>
      </div>
      
      {permissionStatus === 'denied' && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Acesso ao microfone negado. Por favor, permita o acesso nas configurações do seu navegador.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={isListening ? "destructive" : "default"}
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing || attemptingToStart || permissionStatus === 'denied'}
          className="flex items-center gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              Parar Gravação
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {attemptingToStart ? "Iniciando..." : "Iniciar Gravação"}
            </>
          )}
        </Button>
      </div>
      
      {isListening && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${currentlyListening ? 'bg-red-500 animate-pulse' : 'bg-muted'}`}></div>
            <span className="text-sm">{currentlyListening ? "Ouvindo..." : (transcript ? "Processando silêncio..." : "Aguardando fala...")}</span>
          </div>
          <Progress value={audioLevel} className="h-2" />
        </div>
      )}
      
      {errorMessage && (
        <div className="text-sm text-red-500 mt-2">
          {errorMessage}
        </div>
      )}
      
      {transcript && (
        <div className="p-4 bg-muted rounded-md text-sm mt-2">
          <p className="font-medium text-xs text-muted-foreground mb-1">Comando detectado:</p>
          <p className="italic text-foreground">"{transcript}"</p>
        </div>
      )}
      
      {isListening && !transcript && !errorMessage && (
        <div className="p-4 bg-primary/10 text-sm rounded-md mt-2">
          <p className="font-medium">Exemplos de comandos:</p>
          <div className="space-y-2 mt-2">
            <p className="italic text-primary">
              "Adicionar despesa de alimentação de 85 reais e 50 centavos para junho"
            </p>
            <p className="italic text-primary">
              "Receita de salário de 2500 reais em janeiro de 2025"
            </p>
            <p className="italic text-primary">
              "Investimento em ações de 300 reais recorrente durante 5 meses para o dia 20"
            </p>
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processando transação com assistente...
        </div>
      )}
    </div>
  );
}
