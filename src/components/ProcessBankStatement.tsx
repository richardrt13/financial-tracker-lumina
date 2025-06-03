import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext'; // Para obter userId
import { transactionEvents } from '@/lib/transactionEvents';
import { extractTransactionsFromImage, ExtractedTransactionData } from '@/lib/genai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, UploadCloud, Trash2, Edit3, CheckCircle, XCircle, AlertTriangle, FileImage } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { defaultCategories, months } from './constants'; // Supondo que você tenha essas constantes
import type { Transaction } from './dashboard/types'; // Tipo de transação final
import { DatePicker } from './ui/date-picker'; // Supondo que você tenha um DatePicker simples

interface ValidatedTransaction extends ExtractedTransactionData {
  id: string; // Para a UI, antes de salvar no DB
  year: string;
  month: string;
  day: string;
  type: 'receita' | 'despesa' | 'investimento';
  category: string;
  amount: number;
  description: string; // Garantir que description seja string
  selected_for_import: boolean;
  is_valid: boolean;
  error_messages?: string[];
}

interface ProcessBankStatementProps {
  budgetId: string | null;
}

const parseAmount = (amountStr?: string): number => {
  if (!amountStr) return 0;
  // Remove R$, espaços, pontos de milhar, e substitui vírgula por ponto decimal
  const cleaned = String(amountStr)
    .replace("R$", "")
    .replace(/\s/g, "")
    .replace(/\./g, "") // Remove pontos de milhar ANTES de trocar vírgula
    .replace(",", ".");  // Substitui vírgula decimal por ponto
  
  const num = parseFloat(cleaned);
  // Retornar o valor absoluto e garantir que não seja NaN
  return isNaN(num) ? 0 : Math.abs(num); // <--- MUDANÇA AQUI
};


const parseDate = (dateStr?: string, currentYear?: number): { day: string, month: string, year: string, fullDate?: Date } => {
    if (!dateStr) return { day: '', month: '', year: String(currentYear || new Date().getFullYear()) };
    
    const yearToUse = currentYear || new Date().getFullYear();
    let day = '', month = '', year = String(yearToUse);
    let parsedDate: Date | undefined;

    const partsSlash = dateStr.split('/');
    const partsHyphen = dateStr.split('-');

    let dParts: string[] = [];
    if (partsSlash.length >= 2) dParts = partsSlash;
    else if (partsHyphen.length >= 2) dParts = partsHyphen;

    if (dParts.length === 2) { // DD/MM
        day = dParts[0].padStart(2, '0');
        month = dParts[1].padStart(2, '0');
        // Tentativa de criar data para validação
        const monthIndex = parseInt(month, 10) - 1;
        if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
            parsedDate = new Date(yearToUse, monthIndex, parseInt(day, 10));
        }
    } else if (dParts.length === 3) { // DD/MM/YYYY ou YYYY/MM/DD ou MM/DD/YYYY
        // Assumindo DD/MM/YYYY como mais comum em extratos BR
        if (dParts[2].length === 4 && parseInt(dParts[2]) > 1900) { // DD/MM/YYYY
            day = dParts[0].padStart(2, '0');
            month = dParts[1].padStart(2, '0');
            year = dParts[2];
        } else if (dParts[0].length === 4 && parseInt(dParts[0]) > 1900) { // YYYY/MM/DD
            year = dParts[0];
            month = dParts[1].padStart(2, '0');
            day = dParts[2].padStart(2, '0');
        } else { // Tentar MM/DD/YYYY (menos comum para BR, mas possível)
            month = dParts[0].padStart(2, '0');
            day = dParts[1].padStart(2, '0');
            year = dParts[2].length === 4 ? dParts[2] : String(yearToUse); // Se ano com 2 digitos, usa current
        }
        const monthIndex = parseInt(month, 10) - 1;
        if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex < 12) {
            parsedDate = new Date(parseInt(year), monthIndex, parseInt(day, 10));
        }
    }
    
    const monthIndex = parseInt(month, 10) -1;
    const finalMonthName = (monthIndex >= 0 && monthIndex < 12) ? months[monthIndex] : "";

    return { day, month: finalMonthName, year, fullDate: parsedDate };
};


export function ProcessBankStatement({ budgetId }: ProcessBankStatementProps) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedTransactions, setExtractedTransactions] = useState<ValidatedTransaction[]>([]);
  const [userCategories, setUserCategories] = useState(defaultCategories);

  useEffect(() => {
    const fetchUserCategories = async () => {
      if (!user?.id) return;
      const { data: categoriesDb, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user.id);
      if (error) {
        console.error('Erro ao buscar categorias do usuário (extrato):', error);
        return;
      }
      if (categoriesDb && categoriesDb.length > 0) {
        const userCatsCopy = JSON.parse(JSON.stringify(defaultCategories));
        categoriesDb.forEach(cat => {
          if (cat.type && userCatsCopy[cat.type as keyof typeof userCatsCopy] && !userCatsCopy[cat.type as keyof typeof userCatsCopy].includes(cat.name)) {
            userCatsCopy[cat.type as keyof typeof userCatsCopy].push(cat.name);
          }
        });
        setUserCategories(userCatsCopy);
      } else {
        setUserCategories(defaultCategories);
      }
    };
    fetchUserCategories();
  }, [user]);


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) { // Limite de 4MB para Gemini API (geralmente)
        toast({ title: "Erro", description: "Arquivo muito grande. O limite é de 4MB.", variant: "destructive" });
        setSelectedFile(null);
        setImagePreview(null);
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setExtractedTransactions([]); // Limpar transações anteriores
    }
  };

  const validateAndPreprocess = (rawData: ExtractedTransactionData[]): ValidatedTransaction[] => {
    const currentFullYear = new Date().getFullYear();
    return rawData.map((item, index) => {
      const { day, month, year, fullDate } = parseDate(item.date_str, currentFullYear);
      const amount = parseAmount(item.amount_str);
      const description = item.description || "Descrição não extraída";
      
      let type: 'receita' | 'despesa' | 'investimento' = item.type_suggestion === 'receita' ? 'receita' : 'despesa';
      // Tentar inferir melhor o tipo com base na descrição
      const lowerDesc = description.toLowerCase();
      if (lowerDesc.includes('salário') || lowerDesc.includes('rendimento') || lowerDesc.includes('crédito') || lowerDesc.includes('depósito')) {
        type = 'receita';
      } else if (lowerDesc.includes('investimento') || lowerDesc.includes('aplicação') || lowerDesc.includes('ações') || lowerDesc.includes('compra de ativo')) {
        type = 'investimento';
      }


      const error_messages: string[] = [];
      if (!day || !month || !year || !fullDate || isNaN(fullDate.getTime())) error_messages.push("Data inválida.");
      if (amount <= 0) error_messages.push("Valor deve ser positivo.");
      if (!description.trim()) error_messages.push("Descrição vazia.");

      return {
        ...item,
        id: `temp-${index}-${Date.now()}`,
        year,
        month,
        day,
        type,
        category: userCategories[type]?.[0] || 'Outros', // Categoria padrão
        amount,
        description,
        selected_for_import: error_messages.length === 0, // Pré-selecionar se não houver erros óbvios
        is_valid: error_messages.length === 0,
        error_messages,
      };
    });
  };

  const handleAnalyzeStatement = async () => {
    if (!selectedFile || !user || !budgetId) {
      toast({ title: "Aviso", description: "Selecione um arquivo de extrato, um orçamento e esteja logado.", variant: "default" });
      return;
    }
    setIsProcessingAI(true);
    setExtractedTransactions([]);
    try {
      const rawData = await extractTransactionsFromImage(selectedFile);
      if (rawData && rawData.length > 0) {
        const processedData = validateAndPreprocess(rawData);
        setExtractedTransactions(processedData);
        toast({ title: "Sucesso", description: `${processedData.length} transações potenciais extraídas. Valide antes de importar.` });
      } else {
        toast({ title: "Nenhuma Transação", description: "Nenhuma transação foi extraída da imagem ou o formato não foi reconhecido.", variant: "default" });
      }
    } catch (error: any) {
      toast({ title: "Erro na Análise", description: error.message || "Não foi possível analisar a imagem.", variant: "destructive" });
    } finally {
      setIsProcessingAI(false);
    }
  };
  
  const handleFieldChange = (id: string, field: keyof ValidatedTransaction, value: any) => {
    setExtractedTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleDateChange = (id: string, date: Date | undefined) => {
    if (date) {
        setExtractedTransactions(prev =>
            prev.map(t => (t.id === id ? { 
                ...t, 
                day: String(date.getDate()).padStart(2, '0'),
                month: months[date.getMonth()],
                year: String(date.getFullYear()),
            } : t))
        );
    }
  };

  const toggleSelectTransaction = (id: string) => {
    setExtractedTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, selected_for_import: !t.selected_for_import } : t))
    );
  };

  const handleRemoveTransaction = (id: string) => {
    setExtractedTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleImportSelected = async () => {
    if (!user || !budgetId) {
      toast({ title: "Erro", description: "Usuário ou orçamento não definido.", variant: "destructive" });
      return;
    }

    const transactionsToImport = extractedTransactions.filter(t => t.selected_for_import && t.is_valid);
    if (transactionsToImport.length === 0) {
      toast({ title: "Nenhuma Transação", description: "Nenhuma transação válida selecionada para importação.", variant: "default" });
      return;
    }

    setIsSaving(true);
    const transactionsForSupabase = transactionsToImport.map(t => ({
      user_id: user.id,
      budget_id: budgetId,
      year: t.year,
      month: t.month, 
      // day: parseInt(t.day), // Supabase não tem campo 'day', a data é inferida de created_at ou via due_day/month/year
      type: t.type,
      category: t.category,
      amount: t.amount,
      description: t.description,
      is_completed: false, // Assumir como não completas inicialmente
      // due_day: t.day ? parseInt(t.day) : null, // Usar `day` como `due_day`? Ou a data completa?
      // Para simplificar, vamos usar a data da transação como referência para due_day se for despesa/investimento
      due_day: (t.type === 'despesa' || t.type === 'investimento') && t.day ? parseInt(t.day) : null,
      created_at: new Date(parseInt(t.year), months.indexOf(t.month), parseInt(t.day)).toISOString() // Construir uma data para created_at
    }));

    try {
      const { error } = await supabase.from('transactions').insert(transactionsForSupabase);
      if (error) throw error;

      toast({ title: "Sucesso!", description: `${transactionsToImport.length} transações importadas.` });
      setExtractedTransactions([]);
      setSelectedFile(null);
      setImagePreview(null);
      transactionEvents.notify(); // Notificar o dashboard
    } catch (error: any) {
      toast({ title: "Erro ao Importar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div className="space-y-6 p-1">
      <h2 className="text-xl font-semibold">Importar Extrato Bancário (Imagem)</h2>
      
      <div className="space-y-2">
        <Label htmlFor="statement-upload">Selecione a imagem do extrato:</Label>
        <Input id="statement-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessingAI || isSaving} />
        {selectedFile && <p className="text-sm text-gray-500">Arquivo: {selectedFile.name}</p>}
      </div>

      {imagePreview && (
        <div className="mt-4 border rounded-md p-2 max-w-md mx-auto">
          <img src={imagePreview} alt="Pré-visualização do extrato" className="max-w-full h-auto max-h-80 object-contain" />
        </div>
      )}

      <Button 
        onClick={handleAnalyzeStatement} 
        disabled={!selectedFile || isProcessingAI || isSaving}
        className="w-full sm:w-auto"
      >
        {isProcessingAI ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
        Analisar Extrato com IA
      </Button>

      {extractedTransactions.length > 0 && (
        <div className="space-y-4 mt-6">
          <h3 className="text-lg font-semibold">Valide as Transações Extraídas:</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Importar</TableHead>
                  <TableHead className="min-w-[120px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="min-w-[120px]">Valor (R$)</TableHead>
                  <TableHead className="min-w-[130px]">Tipo</TableHead>
                  <TableHead className="min-w-[150px]">Categoria</TableHead>
                  <TableHead className="w-[50px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedTransactions.map((t) => (
                  <TableRow key={t.id} className={!t.is_valid ? 'bg-red-50 hover:bg-red-100' : (t.selected_for_import ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-50')}>
                    <TableCell>
                      <input 
                        type="checkbox"
                        checked={t.selected_for_import}
                        onChange={() => toggleSelectTransaction(t.id)}
                        disabled={!t.is_valid || isSaving}
                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                    </TableCell>
                    <TableCell>
                      <DatePicker
                        date={t.year && t.month && t.day ? new Date(parseInt(t.year), months.indexOf(t.month), parseInt(t.day)) : undefined}
                        onDateChange={(date) => handleDateChange(t.id, date)}
                        className="w-full h-9 text-xs"
                      />
                       {t.error_messages?.includes("Data inválida.") && <p className="text-xs text-red-500">Data inválida</p>}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={t.description}
                        onChange={(e) => handleFieldChange(t.id, 'description', e.target.value)}
                        className={`h-9 text-xs ${t.error_messages?.includes("Descrição vazia.") ? 'border-red-500' : ''}`}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text" // Para permitir vírgula
                        value={t.amount_str || t.amount.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}
                        onChange={(e) => {
                            handleFieldChange(t.id, 'amount_str', e.target.value);
                            handleFieldChange(t.id, 'amount', parseAmount(e.target.value));
                        }}
                        className={`h-9 text-xs text-right ${t.error_messages?.includes("Valor deve ser positivo.") ? 'border-red-500' : ''}`}
                        disabled={isSaving}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={t.type}
                        onValueChange={(value: 'receita' | 'despesa' | 'investimento') => handleFieldChange(t.id, 'type', value)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receita">Receita</SelectItem>
                          <SelectItem value="despesa">Despesa</SelectItem>
                          <SelectItem value="investimento">Investimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                       <Select
                        value={t.category}
                        onValueChange={(value) => handleFieldChange(t.id, 'category', value)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(userCategories[t.type] || []).map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                           <SelectItem value="Outros">Outros (Padrão)</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveTransaction(t.id)} disabled={isSaving} title="Remover esta linha">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Button onClick={handleImportSelected} disabled={extractedTransactions.filter(t=>t.selected_for_import && t.is_valid).length === 0 || isSaving || isProcessingAI} className="w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
            Importar {extractedTransactions.filter(t=>t.selected_for_import && t.is_valid).length} Transações Selecionadas
          </Button>
          {extractedTransactions.some(t => !t.is_valid && t.selected_for_import) && (
            <p className="text-sm text-red-600 flex items-center"><AlertTriangle className="h-4 w-4 mr-2"/>Algumas transações selecionadas contêm erros e não serão importadas. Corrija-as ou desmarque-as.</p>
          )}
        </div>
      )}
    </div>
  );
}