import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { months as monthNames } from './constants';
import { generateInsights } from '@/lib/genai';

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
  recurringMonths: string; 
  dueDay: string; 
  description?: string; // Adicionado para consistência com TransactionForm
  linked_income_id?: string | null; // Adicionado para consistência
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
    // console.log("VoiceCommandTransaction: checkMicrophonePermission - Verificando permissão...");
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        // console.log("VoiceCommandTransaction: checkMicrophonePermission - Status atual:", result.state);
        setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        
        result.onchange = () => {
          // console.log("VoiceCommandTransaction: checkMicrophonePermission - Status alterado para:", result.state);
          setPermissionStatus(result.state as 'granted' | 'denied' | 'prompt');
        };
        return result.state;
      } else {
        // console.log("VoiceCommandTransaction: checkMicrophonePermission - API de permissões não suportada, assumindo 'prompt'.");
        return 'prompt'; 
      }
    } catch (error) {
      console.error('VoiceCommandTransaction: checkMicrophonePermission - Erro ao verificar permissões:', error);
      return 'prompt';
    }
  };

  const setupAudioAnalyser = async () => {
    // console.log("VoiceCommandTransaction: setupAudioAnalyser - Configurando analisador de áudio...");
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('VoiceCommandTransaction: setupAudioAnalyser - API de mídia não suportada.');
        throw new Error('API de mídia não suportada neste navegador');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // console.log("VoiceCommandTransaction: setupAudioAnalyser - Stream de áudio obtida.");
      microphoneStreamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      visualizeAudio();
      // console.log("VoiceCommandTransaction: setupAudioAnalyser - Analisador configurado e visualização iniciada.");
      return true;
    } catch (error: any) {
      console.error('VoiceCommandTransaction: setupAudioAnalyser - Erro:', error.name, error.message);
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
      if (!analyserRef.current || !isListening) { // Verifique isListening aqui também
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        setAudioLevel(0); // Reseta o nível quando não está ouvindo
        setCurrentlyListening(false);
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
    // console.log("VoiceCommandTransaction: cleanupResources - Limpando recursos...");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        // console.log("VoiceCommandTransaction: cleanupResources - recognition.stop() chamado.");
      } catch (error) {
        // console.warn("VoiceCommandTransaction: cleanupResources - Erro ao chamar recognition.stop():", error);
      }
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      // console.log("VoiceCommandTransaction: cleanupResources - Animação de áudio cancelada.");
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().then(() => {
        // console.log("VoiceCommandTransaction: cleanupResources - AudioContext fechado.");
      }).catch(error => {
        console.error("VoiceCommandTransaction: cleanupResources - Erro ao fechar AudioContext:", error);
      });
      audioContextRef.current = null;
    }
    
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      microphoneStreamRef.current = null;
      // console.log("VoiceCommandTransaction: cleanupResources - Tracks de microfone paradas.");
    }
    setAudioLevel(0);
    setCurrentlyListening(false);
  };


  const startListening = async () => {
    console.log("VoiceCommandTransaction: startListening - Função chamada!");
    setAttemptingToStart(true);
    setErrorMessage("");
    setTranscript(""); 
    
    const permissionState = await checkMicrophonePermission();
    // console.log("VoiceCommandTransaction: startListening - Estado da permissão:", permissionState);
    
    if (permissionState === 'denied') {
      console.error("VoiceCommandTransaction: startListening - Permissão negada.");
      setErrorMessage("Permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone nas configurações do seu navegador.");
      setAttemptingToStart(false);
      return;
    }
     if (permissionState === 'prompt' && !microphoneStreamRef.current) {
      // console.log("VoiceCommandTransaction: startListening - Solicitando permissão de microfone...");
      try {
        // Solicita permissão apenas para verificar, o stream será gerenciado por setupAudioAnalyser
        await navigator.mediaDevices.getUserMedia({ audio: true }).then(tempStream => {
            tempStream.getTracks().forEach(track => track.stop()); // Libera o stream temporário
        });
        // console.log("VoiceCommandTransaction: startListening - Permissão concedida (ou já concedida).");
      } catch (err: any) {
         console.error("VoiceCommandTransaction: startListening - Erro ao solicitar permissão:", err.name, err.message);
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
    
    // console.log("VoiceCommandTransaction: startListening - Configurando analisador de áudio...");
    const audioSetupSuccess = await setupAudioAnalyser();
    
    if (!audioSetupSuccess) {
      console.error("VoiceCommandTransaction: startListening - Falha ao configurar analisador de áudio.");
      setAttemptingToStart(false);
      cleanupResources(); 
      return;
    }
    
    // console.log("VoiceCommandTransaction: startListening - Tentando iniciar reconhecimento...");
    try {
      if (recognitionRef.current) {
        // setIsListening(true); // onstart deve cuidar disso
        recognitionRef.current.start(); // onstart será chamado se bem-sucedido
      } else {
        console.error("VoiceCommandTransaction: startListening - recognitionRef.current é nulo.");
        setErrorMessage("Erro interno: Objeto de reconhecimento não inicializado.");
        cleanupResources();
      }
    } catch (error: any) {
      console.error('VoiceCommandTransaction: startListening - Erro ao chamar recognition.start():', error);
      setErrorMessage(`Erro ao iniciar gravação: ${error.message}`);
      cleanupResources(); 
      setIsListening(false); // Garante que o estado reflita a falha
    }
    
    setAttemptingToStart(false);
  };

  const stopListening = () => {
    // console.log("VoiceCommandTransaction: stopListening - Função chamada.");
    // setIsListening(false); // onend deve cuidar disso
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop(); // onend será chamado
        // console.log("VoiceCommandTransaction: stopListening - recognition.stop() chamado.");
      } catch (error) {
        console.warn("VoiceCommandTransaction: stopListening - Erro ao chamar recognition.stop():", error);
        // Mesmo com erro, forçar o estado e a limpeza de recursos
        setIsListening(false);
        cleanupResources();
      }
    } else {
        // Se recognitionRef for nulo, ainda precisamos garantir que o estado e os recursos sejam limpos
        setIsListening(false);
        cleanupResources();
    }
  };

  const processVoiceCommand = async () => {
    if (!transcript.trim()) {
      // console.log("VoiceCommandTransaction: processVoiceCommand - Transcrição vazia, não processando.");
      cleanupResources(); // Garante a limpeza se chegou aqui por um onend sem resultado
      return;
    }

    // console.log("VoiceCommandTransaction: processVoiceCommand - Iniciando processamento para transcrição:", transcript);
    setIsProcessing(true);
    setErrorMessage(""); 

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
      - "description": string (descrição adicional, se houver). Se não, string vazia.
      - "isRecurring": boolean (true se for uma transação recorrente/mensal/parcelada, false caso contrário).
      - "recurringMonths": string (número de meses da recorrência como string, ex: "3", "12"). Relevante apenas se isRecurring for true. Se isRecurring for true mas sem duração explícita, use "1". Se isRecurring for false, use "1".
      - "dueDay": string (dia do vencimento como string, ex: "15", "28"). Se não especificado, use "".
      - "linked_income_id": string (ID de uma receita vinculada, se mencionado explicitamente pelo ID. Normalmente não será fornecido por voz). Se não, null.

      Categorias comuns para 'despesa': "Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Contas", "Educação", "Impostos", "Outros".
      Categorias comuns para 'receita': "Salário", "Freelance", "Investimentos", "Rendimentos", "Presente", "Outros".
      Categorias comuns para 'investimento': "Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Imóveis", "Outros".

      Se o usuário mencionar "todo mês", "mensalmente", "recorrente" ou "parcelado", "isRecurring" deve ser true.
      O valor numérico do amount deve ser extraído, por exemplo, "cinquenta reais e vinte e cinco centavos" deve ser 50.25.
      Se "recurringMonths" for mencionado (ex: "por 3 meses", "durante 6 meses", "em 5 parcelas"), extraia o número de meses.
      O "dueDay" refere-se ao dia do mês para o vencimento. Se mencionado "dia dez", use "10".

      Exemplo de entrada: "Lançar despesa com supermercado de cento e cinquenta reais e setenta e cinco centavos para o dia 10 de maio de 2024, recorrente por 3 meses com descrição compras da semana"
      Exemplo de saída JSON esperada:
      {
        "type": "despesa",
        "category": "Alimentação",
        "amount": 150.75,
        "month": "Maio",
        "year": "2024",
        "description": "compras da semana",
        "isRecurring": true,
        "recurringMonths": "3",
        "dueDay": "10",
        "linked_income_id": null
      }
      Texto do usuário: "${transcript}"
      Objeto JSON:
    `;

    try {
      // console.log("VoiceCommandTransaction: processVoiceCommand - Enviando prompt para Gemini...");
      const geminiResponse = await generateInsights(prompt);
      // console.log("VoiceCommandTransaction: processVoiceCommand - Resposta da Gemini recebida:", geminiResponse);
      let transactionInfo: Partial<Transaction> = {};

      try {
        const cleanedResponse = geminiResponse.replace(/^```json\s*|```\s*$/g, '').trim();
        transactionInfo = JSON.parse(cleanedResponse);
        // console.log("VoiceCommandTransaction: processVoiceCommand - JSON parseado:", transactionInfo);
      } catch (e) {
        console.error("VoiceCommandTransaction: processVoiceCommand - Erro ao parsear JSON da Gemini:", e, "Resposta original:", geminiResponse);
        toast({
          title: "Erro de Interpretação (IA)",
          description: "Não consegui entender o formato da resposta do assistente. Tente ser mais específico ou verifique o console para detalhes.",
          variant: "destructive"
        });
        setTranscript(""); 
        return; 
      }

      const validatedTransaction: Transaction = {
        type: ['receita', 'despesa', 'investimento'].includes(transactionInfo.type as any) ? transactionInfo.type as Transaction['type'] : 'despesa',
        category: typeof transactionInfo.category === 'string' && transactionInfo.category.trim() !== '' ? transactionInfo.category : 'Outros',
        amount: typeof transactionInfo.amount === 'number' && transactionInfo.amount > 0 ? transactionInfo.amount : 0,
        month: typeof transactionInfo.month === 'string' && monthNames.map(m => m.toLowerCase()).includes(transactionInfo.month.toLowerCase()) ? monthNames.find(m => m.toLowerCase() === transactionInfo.month!.toLowerCase())! : currentMonthName,
        year: typeof transactionInfo.year === 'string' && /^\d{4}$/.test(transactionInfo.year) ? transactionInfo.year : currentYearName,
        description: typeof transactionInfo.description === 'string' ? transactionInfo.description : "",
        isRecurring: typeof transactionInfo.isRecurring === 'boolean' ? transactionInfo.isRecurring : false,
        recurringMonths: typeof transactionInfo.recurringMonths === 'string' && transactionInfo.recurringMonths.trim() !== '' ? transactionInfo.recurringMonths : "1",
        dueDay: typeof transactionInfo.dueDay === 'string' ? transactionInfo.dueDay : "",
        linked_income_id: transactionInfo.linked_income_id || null,
      };
      
      if (validatedTransaction.amount <= 0) {
        // console.warn("VoiceCommandTransaction: processVoiceCommand - Valor da transação inválido:", validatedTransaction.amount);
        toast({
          title: "Valor Inválido",
          description: "Não foi possível identificar um valor monetário válido (maior que zero) para a transação. Por favor, tente novamente.",
          variant: "destructive"
        });
        setTranscript("");
        return;
      }
      
      // console.log("VoiceCommandTransaction: processVoiceCommand - Transação validada:", validatedTransaction);
      onTransactionRecognized(validatedTransaction); 
      await onSubmitTransaction(validatedTransaction); 

      toast({
        title: "Sucesso!",
        description: `Transação adicionada: ${validatedTransaction.type}, ${validatedTransaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, Cat: ${validatedTransaction.category}`,
      });
      setTranscript(""); 
    } catch (error: any) {
      console.error('VoiceCommandTransaction: processVoiceCommand - Erro no processamento ou submissão:', error);
      toast({
        title: "Erro no Processamento",
        description: error.message || "Ocorreu um erro ao processar o comando de voz ou ao adicionar a transação.",
        variant: "destructive"
      });
      setTranscript("");
    } finally {
      setIsProcessing(false);
      cleanupResources(); 
    }
  };

  useEffect(() => {
    console.log("VoiceCommandTransaction: useEffect inicializando...");
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      console.error("VoiceCommandTransaction: API SpeechRecognition não suportada.");
      setErrorMessage("Seu navegador não suporta reconhecimento de voz.");
      return;
    }
    console.log("VoiceCommandTransaction: API SpeechRecognition suportada.");

    checkMicrophonePermission();

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognitionAPI();
    recognitionRef.current.continuous = false; 
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'pt-BR';

    recognitionRef.current.onstart = () => {
        console.log("VoiceCommandTransaction: onstart - Reconhecimento efetivamente iniciado.");
        setIsListening(true); // Sincroniza o estado com o evento real
        toast({
            title: "Microfone ativado",
            description: "Fale seu comando de voz agora.",
        });
    };
    // Dentro do useEffect de inicialização:
    recognitionRef.current.onaudiostart = () => {
        console.log("VoiceCommandTransaction: onaudiostart - Captura de áudio iniciada pela API.");
    };
    
    recognitionRef.current.onsoundstart = () => { // Algumas implementações usam onsoundstart
        console.log("VoiceCommandTransaction: onsoundstart - Som detectado pela API.");
    };
    
    recognitionRef.current.onspeechstart = () => {
        console.log("VoiceCommandTransaction: onspeechstart - Detecção de fala iniciada pela API.");
    };
    
    recognitionRef.current.onspeechend = () => {
        console.log("VoiceCommandTransaction: onspeechend - Detecção de fala finalizada pela API.");
    };
    
    recognitionRef.current.onsoundend = () => { // Algumas implementações usam onsoundend
        console.log("VoiceCommandTransaction: onsoundend - Fim do som detectado pela API.");
    };
    
    recognitionRef.current.onresult = (event: any) => {
      // Mantenha os logs detalhados aqui como na versão anterior
      console.log("VoiceCommandTransaction: onresult - Evento recebido:", JSON.stringify(event.results));
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        console.log(`VoiceCommandTransaction: onresult - Resultado [<span class="math-inline">\{i\}\]\: isFinal\=</span>{event.results[i].isFinal}, transcript=<span class="math-inline">\{event\.results\[i\]\[0\]\.transcript\}, confidence\=</span>{event.results[i][0].confidence}`);
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      console.log("VoiceCommandTransaction: onresult - Transcrições - Final:", finalTranscript, "Provisória:", interimTranscript);
      setTranscript(finalTranscript || interimTranscript);
    };
    
    recognitionRef.current.onerror = (event: any) => {
      // Mantenha os logs detalhados aqui
      console.error('VoiceCommandTransaction: onerror - Erro no reconhecimento:', event.error, event.message ? `Mensagem: ${event.message}` : '');
      // ... resto do tratamento de erro ...
       setIsListening(false); 
       cleanupResources(); 
    };
    
    recognitionRef.current.onend = () => {
        console.log("VoiceCommandTransaction: onend - API de reconhecimento finalizada. Estado de isListening:", isListening, "Transcript:", transcript); // Adicionado estado atual
         // O estado de isListening será false aqui se onstart não for chamado ou se onerror/onend já o definiram.
         // Se onstart definiu isListening para true e não houve erro, este onend irá naturalmente redefinir
        setIsListening(false); 
        if (!transcript.trim() && !isProcessing) { 
           cleanupResources();
        }
        // Se houver transcript, o useEffect [isListening, transcript, isProcessing] cuidará do processamento.
      // console.log("VoiceCommandTransaction: onresult - Final:", finalTranscript, "Interim:", interimTranscript);
      setTranscript(finalTranscript || interimTranscript); // Atualiza o estado para visualização e para o useEffect que processa
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('VoiceCommandTransaction: onerror - Erro no reconhecimento:', event.error, event.message);
      let specificError = `Erro no reconhecimento: ${event.error}`;
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPermissionStatus('denied');
        specificError = 'Permissão para acessar o microfone negada.';
        setErrorMessage(specificError);
      } else if (event.error === 'aborted') {
        specificError = "Gravação interrompida.";
        // Não mostrar toast se foi uma parada intencional ou pelo silence timer
        if (isListening && !attemptingToStart) { // Evita toast se stopListening foi chamado
            toast({ title: "Gravação interrompida", description: "A gravação foi interrompida antes de um comando completo.", variant: "default" });
        }
      } else if (event.error === 'no-speech') {
        specificError = "Nenhuma fala detectada. Tente novamente.";
        toast({ title: "Nenhuma fala detectada", description: "Por favor, fale mais alto ou verifique seu microfone.", variant: "destructive" });
      } else if (event.error === 'network') {
        specificError = "Erro de rede durante o reconhecimento. Verifique sua conexão.";
        toast({ title: "Erro de Rede", description: specificError, variant: "destructive" });
      } else if (event.error === 'audio-capture') {
        specificError = "Falha na captura de áudio. Verifique seu microfone.";
        toast({ title: "Erro de Áudio", description: specificError, variant: "destructive" });
      } else {
        setErrorMessage(specificError);
      }
      setIsListening(false); 
      cleanupResources(); 
    };

    recognitionRef.current.onend = () => {
        // console.log("VoiceCommandTransaction: onend - Reconhecimento finalizado.");
         setIsListening(false); 
         // Não chamar cleanupResources aqui diretamente, pois onend pode ser seguido por processVoiceCommand
         // A limpeza será feita no finally do processVoiceCommand ou se não houver transcript.
         if (!transcript.trim() && !isProcessing) { // Limpa se terminou sem nada para processar
            cleanupResources();
         }
    };
    
    console.log("VoiceCommandTransaction: useEffect - Callbacks de reconhecimento configurados.");

    return () => {
      console.log("VoiceCommandTransaction: useEffect cleanup - Limpando reconhecimento e recursos.");
      cleanupResources();
      if (recognitionRef.current) {
          // Remove listeners para evitar memory leaks, embora o objeto vá ser descartado
          recognitionRef.current.onstart = null;
          recognitionRef.current.onaudiostart = null;
          recognitionRef.current.onspeechstart = null;
          recognitionRef.current.onspeechend = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current = null; // Ajuda o garbage collector
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // O array de dependências vazio garante que isso rode apenas uma vez


  useEffect(() => {
    let silenceTimer: NodeJS.Timeout | null = null;
    if (isListening && transcript.trim() && !currentlyListening && recognitionRef.current) {
      // console.log("VoiceCommandTransaction: useEffect[silenceTimer] - Detectado silêncio após fala, iniciando timer para parar.");
      silenceTimer = setTimeout(() => {
        if (isListening && transcript.trim() && !currentlyListening && recognitionRef.current) {
          // console.log("VoiceCommandTransaction: useEffect[silenceTimer] - Timer de silêncio expirou, parando de ouvir.");
          stopListening(); 
        }
      }, 1500); // Reduzido para 1.5 segundos
    }
    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
    };
  }, [isListening, transcript, currentlyListening]); // Removido stopListening das dependências

  useEffect(() => {
    if (!isListening && transcript.trim() && !isProcessing) {
      // console.log("VoiceCommandTransaction: useEffect[process] - Condições para processar atingidas.");
      processVoiceCommand();
    } else if (!isListening && !transcript.trim() && !isProcessing) {
        // console.log("VoiceCommandTransaction: useEffect[process] - Não está ouvindo, sem transcrição, sem processamento. Limpando se necessário.");
        // cleanupResources(); // Chamada aqui pode ser redundante se onend e onerror já limpam
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript, isProcessing]); // Adicionado onTransactionRecognized, onSubmitTransaction

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-medium">Adicionar Transação por Voz (via IA)</h3>
        <p className="text-sm text-gray-500">
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
          variant={isListening || attemptingToStart ? "destructive" : "default"}
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing || permissionStatus === 'denied'}
          className="flex items-center gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              Parar Gravação
            </>
          ) : attemptingToStart ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Iniciando...
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Iniciar Gravação
            </>
          )}
        </Button>
      </div>
      
      {isListening && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${currentlyListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">{currentlyListening ? "Ouvindo..." : (transcript.trim() ? "Processando silêncio..." : "Aguardando fala...")}</span>
          </div>
          <Progress value={audioLevel} className="h-2" />
        </div>
      )}
      
      {errorMessage && (
        <div className="text-sm text-red-500 mt-2">
          {errorMessage}
        </div>
      )}
      
      {transcript && !isProcessing && ( // Mostrar transcrição apenas se não estiver processando
        <div className="p-4 bg-gray-100 rounded-md text-sm mt-2">
          <p className="font-medium text-xs text-gray-500 mb-1">Comando detectado:</p>
          <p className="italic text-gray-800">"{transcript}"</p>
        </div>
      )}
      
      {isListening && !transcript.trim() && !errorMessage && (
        <div className="p-4 bg-blue-50 text-sm rounded-md mt-2">
          <p className="font-medium">Exemplos de comandos:</p>
          <div className="space-y-2 mt-2">
            <p className="italic text-blue-700">
              "Adicionar despesa de alimentação de 85 reais e 50 centavos para junho"
            </p>
            <p className="italic text-blue-700">
              "Receita de salário de 2500 reais em janeiro de 2025"
            </p>
            <p className="italic text-blue-700">
              "Investimento em ações de 300 reais recorrente durante 5 meses para o dia 20"
            </p>
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processando transação com assistente...
        </div>
      )}
    </div>
  );
}
