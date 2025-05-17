import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, Check, X, Edit } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { months } from './constants';

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
};

interface VoiceCommandTransactionProps {
  onTransactionRecognized: (transaction: Transaction) => void;
  onSubmitTransaction: (transaction: Transaction) => Promise<void>;
}

const PATTERNS = {
  TIPOS: {
    RECEITA: /(receita|recebimento|receber|entrada|ganho|ganhar|recebido)/i,
    DESPESA: /(despesa|gasto|pagamento|pagar|saída|custo|gastei|paguei)/i,
    INVESTIMENTO: /(investimento|investir|aplica[rç][ãa]o|aplicar|apliquei)/i
  },
  VALOR: /(\d+)(?: reais| reais e| e)?(?:[,.](\d+))?(?: centavos| centavo)?(?: reais?)?/i,
  MES: new RegExp(months.join('|'), 'i'),
  ANO: /(20\d{2})/,
  RECORRENCIA: /(recorrente|todo m[êe]s|mensal|parcela|repetir)/i,
  PERIODO_RECORRENCIA: /(durante|por|) (\d+)(?: |-)?(meses|mes|mês)/i,
  VENCIMENTO: /(vence|vencimento|dia) (\d{1,2})/i
};

const CATEGORIAS = {
  receita: [
    { patterns: [/sal[áa]rio/i], name: "Salário" },
    { patterns: [/freelance/i, /freelancer/i, /trabalho extra/i], name: "Freelance" },
    { patterns: [/investimento/i, /dividendo/i, /juros/i, /rendimento/i], name: "Investimentos" },
    { patterns: [/outro/i, /diversos/i], name: "Outros" }
  ],
  despesa: [
    { patterns: [/moradia/i, /aluguel/i, /condom[ií]nio/i, /hipoteca/i, /casa/i, /apartamento/i], name: "Moradia" },
    { patterns: [/alimenta[çc][ãa]o/i, /comida/i, /restaurante/i, /supermercado/i, /mercado/i], name: "Alimentação" },
    { patterns: [/transporte/i, /gasolina/i, /[ôo]nibus/i, /metr[ôo]/i, /uber/i, /99/i, /táxi/i, /taxi/i], name: "Transporte" },
    { patterns: [/sa[úu]de/i, /m[ée]dico/i, /hospital/i, /rem[ée]dio/i, /farm[áa]cia/i], name: "Saúde" },
    { patterns: [/lazer/i, /diversão/i, /cinema/i, /viagem/i, /passeio/i], name: "Lazer" },
    { patterns: [/outro/i, /diversos/i], name: "Outros" }
  ],
  investimento: [
    { patterns: [/a[çc][õo]es/i, /bolsa/i, /stock/i], name: "Ações" },
    { patterns: [/fundo/i], name: "Fundos" },
    { patterns: [/renda fixa/i, /cdb/i, /tesouro/i, /lci/i, /lca/i], name: "Renda Fixa" },
    { patterns: [/cripto/i, /bitcoin/i, /ethereum/i], name: "Criptomoedas" },
    { patterns: [/outro/i, /diversos/i], name: "Outros" }
  ]
};

const recognizeMonth = (text: string): string => {
  for (let i = 0; i < months.length; i++) {
    if (text.toLowerCase().includes(months[i].toLowerCase())) {
      return months[i];
    }
  }
  return months[new Date().getMonth()];
};

const recognizeCategory = (text: string, type: string): string => {
  const categories = CATEGORIAS[type as keyof typeof CATEGORIAS] || [];
  
  for (const category of categories) {
    for (const pattern of category.patterns) {
      if (pattern.test(text)) {
        return category.name;
      }
    }
  }
  
  return type === 'receita' ? 'Outros' : 
         type === 'despesa' ? 'Outros' : 'Outros';
};

const extractTransactionInfo = (transcript: string): Transaction => {
  const text = transcript.toLowerCase();
  const result: Transaction = {
    type: 'despesa',
    category: 'Outros',
    amount: 0,
    month: months[new Date().getMonth()],
    year: new Date().getFullYear().toString(),
    isRecurring: false,
    recurringMonths: "1",
    dueDay: ""
  };
  
  if (PATTERNS.TIPOS.RECEITA.test(text)) {
    result.type = "receita";
  } else if (PATTERNS.TIPOS.DESPESA.test(text)) {
    result.type = "despesa";
  } else if (PATTERNS.TIPOS.INVESTIMENTO.test(text)) {
    result.type = "investimento";
  }
  
  result.category = recognizeCategory(text, result.type);
  
  const valorMatch = text.match(PATTERNS.VALOR);
  if (valorMatch) {
    const reais = valorMatch[1] ? parseInt(valorMatch[1]) : 0;
    const centavos = valorMatch[2] ? parseInt(valorMatch[2].padEnd(2, '0')) / 100 : 0;
    result.amount = reais + centavos;
  }
  
  const monthMatch = text.match(PATTERNS.MES);
  if (monthMatch) {
    result.month = recognizeMonth(monthMatch[0]);
  }
  
  const anoMatch = text.match(PATTERNS.ANO);
  if (anoMatch) {
    result.year = anoMatch[1];
  }
  
  if (PATTERNS.RECORRENCIA.test(text)) {
    result.isRecurring = true;
    
    const periodoMatch = text.match(PATTERNS.PERIODO_RECORRENCIA);
    if (periodoMatch) {
      result.recurringMonths = periodoMatch[2];
    }
  }
  
  const vencimentoMatch = text.match(PATTERNS.VENCIMENTO);
  if (vencimentoMatch) {
    result.dueDay = vencimentoMatch[2];
  }
  
  return result;
};

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
    } catch (error) {
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
        console.error('Erro ao parar reconhecimento:', error);
      }
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
    }
    
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      microphoneStreamRef.current = null;
    }
  };

  const startListening = async () => {
    setAttemptingToStart(true);
    setErrorMessage("");
    
    const permissionState = await checkMicrophonePermission();
    
    if (permissionState === 'denied') {
      setErrorMessage("Permissão para usar o microfone foi negada. Por favor, permita o acesso ao microfone nas configurações do seu navegador.");
      setAttemptingToStart(false);
      return;
    }
    
    const audioSetupSuccess = await setupAudioAnalyser();
    
    if (!audioSetupSuccess) {
      setAttemptingToStart(false);
      return;
    }
    
    setIsListening(true);
    setTranscript("");
    
    try {
      if (recognitionRef.current) {
        recognitionRef.current.start();
        toast({
          title: "Microfone ativado",
          description: "Fale seu comando de voz agora.",
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar reconhecimento:', error);
      setErrorMessage(`Erro ao iniciar: ${error.message}`);
      cleanupResources();
    }
    
    setAttemptingToStart(false);
  };

  const stopListening = () => {
    setIsListening(false);
    setCurrentlyListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Erro ao parar reconhecimento:', error);
      }
    }
    
    cleanupResources();
  };

  const processVoiceCommand = async () => {
    if (!transcript.trim()) {
      toast({
        title: "Erro",
        description: "Nenhum comando de voz detectado. Tente novamente.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const transactionInfo = extractTransactionInfo(transcript);
      
      if (!transactionInfo.type || transactionInfo.amount <= 0) {
        toast({
          title: "Comando incompleto",
          description: "Não foi possível identificar todos os detalhes necessários.",
          variant: "destructive"
        });
        return;
      }
      
      onTransactionRecognized(transactionInfo);
      await onSubmitTransaction(transactionInfo);
      
      setTranscript("");
      
    } catch (error) {
      console.error('Erro ao processar comando:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar o comando de voz.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      stopListening();
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
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'pt-BR';
    
    recognitionRef.current.onresult = (event: any) => {
      const currentTranscript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      
      setTranscript(currentTranscript);
    };
    
    recognitionRef.current.onerror = (event: any) => {
      console.error('Erro no reconhecimento de voz:', event.error);
      
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPermissionStatus('denied');
        setErrorMessage('Permissão para acessar o microfone negada.');
      } else if (event.error === 'aborted') {
        if (attemptingToStart) {
          toast({
            title: "Reconhecimento interrompido",
            description: "Por favor, tente novamente.",
            variant: "destructive"
          });
          setAttemptingToStart(false);
        }
      } else {
        setErrorMessage(`Erro: ${event.error}`);
      }
      
      if (isListening) {
        stopListening();
      }
    };
    
    recognitionRef.current.onend = () => {
      if (isListening && !isProcessing) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Erro ao reiniciar reconhecimento:', error);
          stopListening();
        }
      }
    };
    
    return () => {
      cleanupResources();
    };
  }, [isListening]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isListening && !currentlyListening && transcript) {
        stopListening();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [currentlyListening, isListening, transcript]);

  useEffect(() => {
    if (!isListening && transcript) {
      processVoiceCommand();
    }
  }, [isListening, transcript]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-lg font-medium">Adicionar Transação por Voz</h3>
        <p className="text-sm text-gray-500">
          Você pode adicionar transações dizendo comandos como "Adicionar despesa de alimentação de 80 reais".
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
          disabled={isProcessing || permissionStatus === 'denied'}
          className="flex items-center gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              Parar
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              {attemptingToStart ? "Iniciando..." : "Iniciar gravação"}
            </>
          )}
        </Button>
      </div>
      
      {isListening && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${currentlyListening ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">{currentlyListening ? "Ouvindo..." : "Silêncio..."}</span>
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
        <div className="p-4 bg-gray-100 rounded-md text-sm mt-2">
          <p className="font-medium text-xs text-gray-500 mb-1">Comando detectado:</p>
          <p className="italic text-gray-800">"{transcript}"</p>
        </div>
      )}
      
      {isListening && !transcript && (
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
              "Investimento em ações de 300 reais recorrente durante 5 meses"
            </p>
          </div>
        </div>
      )}
      
      {isProcessing && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Processando transação...
        </div>
      )}
    </div>
  );
}