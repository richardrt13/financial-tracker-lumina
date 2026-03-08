import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Plus } from "lucide-react";
import { supabase } from '@/lib/supabase';
import { transactionEvents } from '@/lib/transactionEvents';
import { toast } from "@/components/ui/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker"; // Import DatePicker
import { VoiceCommandTransaction } from './VoiceCommandTransaction';
import type { Transaction as TransactionType } from './dashboard/types';
import { useSmartSuggestions } from '@/hooks/useSmartSuggestions';

// Re-add months array for helper purposes
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const NONE_VALUE_MARKER = "__NONE_INCOME_LINK_FORM__";

const defaultCategories = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Contas", "Educação", "Impostos", "Outros"],
  investimento: ["Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Imóveis", "Outros"]
};

const formSchema = z.object({
  date: z.date({
    required_error: "A data da transação é obrigatória.",
  }),
  type: z.enum(["receita", "despesa", "investimento"]),
  category: z.string().min(1, { message: "Categoria é obrigatória." }),
  amount: z.number().or(z.string().transform(val => {
    const cleanedVal = String(val).replace(/\./g, '').replace(',', '.');
    const parsed = Number(cleanedVal);
    if (isNaN(parsed)) return 0;
    return parsed;
  })).refine(val => val > 0, { message: "O valor deve ser maior que zero." }),
  isRecurring: z.boolean().default(false),
  recurringMonths: z.string().or(z.number()).transform(val => {
    if (val === '') return ''; 
    const parsed = typeof val === 'string' ? parseInt(val) : val;
    return isNaN(parsed) ? 1 : parsed;
  }).refine(val => val === '' || (typeof val === 'number' && val >= 1 && val <= 60), {
    message: "A duração deve ser entre 1 e 60 meses"
  }),
  linked_income_id: z.string().optional().nullable(),
  description: z.string().optional(),
});

type TransactionFormProps = {
  budgetId: string;
};

export function TransactionForm({ budgetId }: TransactionFormProps) {
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categories, setCategories] = useState(defaultCategories);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currentType, setCurrentType] = useState<"receita" | "despesa" | "investimento">("receita");
  const [recurringMonthsInput, setRecurringMonthsInput] = useState<string>("1");
  const [formattedAmount, setFormattedAmount] = useState<string>("0,00");

  const [availableIncomes, setAvailableIncomes] = useState<TransactionType[]>([]);
  const [descriptionSuggestions, setDescriptionSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestCategory, suggestDescriptions, suggestAmount } = useSmartSuggestions(userId, budgetId);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      type: "receita",
      category: "",
      amount: 0,
      isRecurring: false,
      recurringMonths: 1, // Fix: Pass number directly
      linked_income_id: null,
      description: "",
    },
  });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    checkUser();
  }, []);

  useEffect(() => {
    const fetchUserCategories = async () => {
      if (!userId) return;
      const { data: userCategoriesDb, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);
      if (error) {
        console.error('Erro ao buscar categorias do usuário:', error);
        return;
      }
      if (userCategoriesDb && userCategoriesDb.length > 0) {
        const userCatsCopy = JSON.parse(JSON.stringify(defaultCategories)); 
        userCategoriesDb.forEach(cat => {
          if (cat.type && userCatsCopy[cat.type as keyof typeof userCatsCopy] && !userCatsCopy[cat.type as keyof typeof userCatsCopy].includes(cat.name)) {
            userCatsCopy[cat.type as keyof typeof userCatsCopy].push(cat.name);
          }
        });
        setCategories(userCatsCopy);
      } else {
        setCategories(defaultCategories); // Reset to default if no user categories
      }
    };
    if (userId) {
      fetchUserCategories();
    } else {
      setCategories(defaultCategories); // Reset if no user
    }
  }, [userId]);

  useEffect(() => {
    if (budgetId) {
      form.reset({
        date: new Date(),
        type: "receita",
        category: "",
        amount: 0,
        isRecurring: false,
        recurringMonths: 1,
        linked_income_id: null,
        description: "",
      });
      setFormattedAmount("0,00");
      setRecurringMonthsInput("1");
      setCurrentType("receita");
    }
  }, [budgetId, form]);

  useEffect(() => {
    const fetchAvailableIncomes = async () => {
      const date = form.getValues('date');
      const currentMonth = months[date.getMonth()];
      const currentYear = String(date.getFullYear());
      
      if ((currentType !== 'despesa' && currentType !== 'investimento') || !userId || !budgetId) {
        setAvailableIncomes([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('transactions')
        .select('id, description, category, amount')
        .eq('user_id', userId)
        .eq('budget_id', budgetId)
        .eq('type', 'receita')
        .eq('month', currentMonth)
        .eq('year', currentYear);
      if (error) {
        console.error('Error fetching available incomes:', error);
        toast({ title: "Erro", description: "Não foi possível buscar as receitas para vinculação.", variant: "destructive" });
        setAvailableIncomes([]);
      } else {
        setAvailableIncomes(data as TransactionType[] || []);
      }
    };
    fetchAvailableIncomes();
  }, [currentType, form.watch('date'), userId, budgetId]); // Watch date changes

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        setCurrentType(value.type as "receita" | "despesa" | "investimento");
        form.setValue("category", ""); 
        form.setValue("linked_income_id", null); 
      }
    });
    return () => subscription.unsubscribe();
  }, [form]); 

  const handleVoiceRecognition = (transactionInfo: any) => {
     if (transactionInfo.type) {
      form.setValue("type", transactionInfo.type);
      setCurrentType(transactionInfo.type);
    }
    if (transactionInfo.category) form.setValue("category", transactionInfo.category);
    
    if (transactionInfo.amount > 0) {
        const numericAmount = Number(transactionInfo.amount);
        form.setValue("amount", numericAmount); 
        const formatted = numericAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        setFormattedAmount(formatted);
    }
    
    // Logic for month/year from voice command to Date object
    if (transactionInfo.month && transactionInfo.year && months.includes(transactionInfo.month)) {
        const monthIndex = months.indexOf(transactionInfo.month);
        const year = parseInt(transactionInfo.year);
        // Default to day 1 if dueDay not provided or use dueDay
        const day = transactionInfo.dueDay ? parseInt(transactionInfo.dueDay) : new Date().getDate(); 
        // Need validation for Day
        form.setValue("date", new Date(year, monthIndex, day));
    } else if (transactionInfo.dueDay) {
        // If only dueDay provided, assume current month/year but specific day
        const current = form.getValues('date');
        form.setValue("date", new Date(current.getFullYear(), current.getMonth(), parseInt(transactionInfo.dueDay)));
    }

    if (transactionInfo.description) form.setValue("description", transactionInfo.description);
    if (transactionInfo.isRecurring !== undefined) {
        form.setValue("isRecurring", transactionInfo.isRecurring);
        if (transactionInfo.isRecurring && transactionInfo.recurringMonths) {
            form.setValue("recurringMonths", parseInt(String(transactionInfo.recurringMonths))); // Fix: Parse to int
            setRecurringMonthsInput(String(transactionInfo.recurringMonths));
        }
    }
    if (transactionInfo.linked_income_id) {
        form.setValue("linked_income_id", String(transactionInfo.linked_income_id));
    } else {
        form.setValue("linked_income_id", null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isLoading) return;
    if (!userId || !budgetId) {
      toast({ title: "Erro", description: "Usuário ou orçamento não identificado.", variant: "destructive" });
      return;
    }

    const recurringMonthsNum = values.isRecurring
      ? (values.recurringMonths === '' ? 1 : parseInt(String(values.recurringMonths)))
      : 1;

    if (values.isRecurring && (isNaN(recurringMonthsNum) || recurringMonthsNum < 1 || recurringMonthsNum > 60)) {
      toast({ title: "Erro", description: "A duração da recorrência deve ser entre 1 e 60 meses.", variant: "destructive" });
      return;
    }
    
    const amountValue = values.amount; 
    if (amountValue <= 0) {
        toast({ title: "Erro", description: "O valor da transação deve ser maior que zero.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      const transactionsToInsert = [];
      const baseDate = values.date;
      
      let currentMonthIdx = baseDate.getMonth();
      let currentYearVal = baseDate.getFullYear();
      let currentDayVal = baseDate.getDate();

      for (let i = 0; i < (values.isRecurring ? recurringMonthsNum : 1); i++) {
        // Recalculate date for recurring
        // Try to keep the same day of month (e.g. always try the 31st)
        let newDate = new Date(currentYearVal, currentMonthIdx + i, currentDayVal);

        // Handling for shorter months:
        // If the original day (currentDayVal) doesn't exist in the target month (e.g. 31st in Feb),
        // the Date object overflows to the next month (e.g. Mar 3rd).
        // Check if day changed from expected currentDayVal.
        if (newDate.getDate() !== currentDayVal) {
             // If overflowed, set to the last day of the intended month.
             // This implements the "closest previous date" logic (e.g. 31st -> 30th/28th).
             newDate = new Date(currentYearVal, currentMonthIdx + i + 1, 0);
        }

        const dateISO = newDate.toISOString().split('T')[0];
        const monthStr = months[newDate.getMonth()];
        const yearStr = String(newDate.getFullYear());


        transactionsToInsert.push({
          type: values.type,
          category: values.category,
          amount: amountValue,
          description: values.description || null,
          user_id: userId,
          budget_id: budgetId,
          status: 'pending',
          is_completed: false,
          due_day: newDate.getDate(), // Still keeping due_day for legacy/compatibility? Or maybe redundant now. Keep for safety.
          year: yearStr,
          month: monthStr,
          date: dateISO,
          linked_income_id: (values.type === 'despesa' || values.type === 'investimento') && values.linked_income_id ? values.linked_income_id : null,
        });
      }

      const { error } = await supabase.from('transactions').insert(transactionsToInsert);
      if (error) throw error;

      toast({ title: "Sucesso", description: `Transação(ões) adicionada(s) com sucesso!` });
      supabase.functions.invoke('process-queue').catch(console.error);
      
      form.reset({
        date: new Date(),
        type: "receita", 
        category: "", 
        amount: 0, 
        isRecurring: false, 
        recurringMonths: 1,
        linked_income_id: null,
        description: "",
      });
      setCurrentType("receita"); 
      setRecurringMonthsInput("1");
      setFormattedAmount("0,00");
      transactionEvents.notify();
    } catch (error: any) {
      console.error('Erro ao adicionar transação:', error);
      toast({ title: "Erro", description: error.message || "Ocorreu um erro.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim() || !userId) return;
    const type = currentType;
    
    const currentCategoriesForType = categories[type] || [];
    if (currentCategoriesForType.includes(newCategory.trim())) {
        toast({ title: "Aviso", description: "Essa categoria já existe para este tipo.", variant: "default" });
        setIsNewCategoryDialogOpen(false);
        form.setValue("category", newCategory.trim());
        return;
    }

    setCategories(prev => ({ ...prev, [type]: [...currentCategoriesForType, newCategory.trim()] }));
    try {
      await supabase.from('categories').insert({ name: newCategory.trim(), type, user_id: userId });
    } catch (error) { console.error('Erro ao salvar categoria:', error); }
    setNewCategory("");
    setIsNewCategoryDialogOpen(false);
    form.setValue("category", newCategory.trim());
  };

  const handleRecurringMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
     if (/^\d*$/.test(value) && (value === "" || (parseInt(value) >= 1 && parseInt(value) <= 60))) {
        setRecurringMonthsInput(value);
        form.setValue("recurringMonths", value === "" ? "" : parseInt(value));
    } else if (value === "") {
        setRecurringMonthsInput("");
        form.setValue("recurringMonths", "");
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let digits = rawValue.replace(/[^\d]/g, ""); // Remove todos não-dígitos

    if (digits === "") {
        setFormattedAmount("0,00");
        form.setValue("amount", 0); // Fix: Send number
        return;
    }

    // Remove zeros à esquerda, exceto se for o único dígito
    if (digits.length > 1 && digits.startsWith('0')) {
        digits = digits.substring(1);
    }
    
    let numericValueForState: string; // Para o react-hook-form, será string com '.'
    let formattedForDisplay: string;  // Para o input, com ','

    if (digits.length <= 2) { // Trata como centavos
        numericValueForState = "0." + digits.padStart(2, '0');
    } else { // Trata como reais e centavos
        const reais = digits.slice(0, -2);
        const centavos = digits.slice(-2);
        numericValueForState = reais + "." + centavos;
    }

    const numberValue = parseFloat(numericValueForState);
    if (isNaN(numberValue)) { // Fallback, should not happen if digits is not empty
      setFormattedAmount("0,00");
      form.setValue("amount", 0); // Fix: Send number
      return;
    }

    form.setValue("amount", numberValue); // Passar o número para o form (Zod espera number)

    // Formatar para exibição
    formattedForDisplay = numberValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    setFormattedAmount(formattedForDisplay);
  };


  return (
    <>
      <VoiceCommandTransaction
        onTransactionRecognized={handleVoiceRecognition}
        onSubmitTransaction={async (transactionDataFromVoice) => {
          // Logic to map voice data to onSubmit format
          // Need to handle missing date in voice command properly, default to today if not provided fully
          const today = new Date();
          const year = transactionDataFromVoice.year ? parseInt(transactionDataFromVoice.year) : today.getFullYear();
          const monthIndex = transactionDataFromVoice.month ? months.indexOf(transactionDataFromVoice.month) : today.getMonth();
          const day = transactionDataFromVoice.dueDay ? parseInt(transactionDataFromVoice.dueDay) : today.getDate();

          const rawDataForZod = {
            date: new Date(year, monthIndex, day),
            type: transactionDataFromVoice.type,
            category: transactionDataFromVoice.category,
            amount: transactionDataFromVoice.amount, 
            isRecurring: transactionDataFromVoice.isRecurring,
            recurringMonths: transactionDataFromVoice.recurringMonths || 1,
            linked_income_id: (transactionDataFromVoice as any).linked_income_id || null, // Cast to any or update type definition
            description: (transactionDataFromVoice as any).description || "" // Cast to any
          };
          try {
            const validatedData = formSchema.parse(rawDataForZod);
            await onSubmit(validatedData);
          } catch (zodError: any) {
            console.error("Zod validation error for voice command data:", zodError.errors);
            const errorMessages = zodError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join('; ') || "Verifique os dados do comando de voz.";
            toast({ title: "Erro ao Validar Dados por Voz", description: errorMessages, variant: "destructive" });
          }
        }}
      />
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Formulário Manual</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
            
            {/* New Date Picker Field replacing Year/Month Selects */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da Transação</FormLabel>
                  <DatePicker 
                    date={field.value} 
                    setDate={field.onChange} 
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo</FormLabel>
                <Select onValueChange={(value) => { field.onChange(value); setCurrentType(value as any); }} value={field.value} defaultValue="receita">
                  <FormControl><SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="receita">Receita</SelectItem>
                    <SelectItem value="despesa">Despesa</SelectItem>
                    <SelectItem value="investimento">Investimento</SelectItem>
                  </SelectContent>
                </Select><FormMessage />
              </FormItem>
            )} />

            {/* ...existing code... Category Field */}
            <div className="flex gap-2 items-end">
              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Categoria</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger></FormControl>
                    <SelectContent>{(categories[currentType] || []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <Button type="button" variant="outline" size="icon" onClick={() => setIsNewCategoryDialogOpen(true)}><Plus className="h-4 w-4" /></Button>
            </div>
            
            {/* Description Field with Smart Suggestions */}
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem className="relative">
                        <FormLabel>Descrição (Opcional)</FormLabel>
                        <FormControl>
                            <Input 
                              placeholder="Ex: Compra semanal, Salário mensal" 
                              {...field} 
                              value={field.value ?? ""} 
                              onChange={(e) => {
                                field.onChange(e);
                                const val = e.target.value;
                                const suggestions = suggestDescriptions(val);
                                setDescriptionSuggestions(suggestions);
                                setShowSuggestions(suggestions.length > 0);
                                
                                const suggestedCat = suggestCategory(val);
                                if (suggestedCat && !form.getValues('category')) {
                                  form.setValue('category', suggestedCat);
                                }
                              }}
                              onFocus={() => {
                                if (descriptionSuggestions.length > 0) setShowSuggestions(true);
                              }}
                              onBlur={() => {
                                setTimeout(() => setShowSuggestions(false), 200);
                              }}
                              autoComplete="off"
                            />
                        </FormControl>
                        {showSuggestions && descriptionSuggestions.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg py-1">
                            {descriptionSuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  form.setValue('description', suggestion);
                                  setShowSuggestions(false);
                                  
                                  const suggestedCat = suggestCategory(suggestion);
                                  if (suggestedCat) form.setValue('category', suggestedCat);
                                  
                                  const suggestedAmt = suggestAmount(suggestion);
                                  if (suggestedAmt && form.getValues('amount') === 0) {
                                    form.setValue('amount', suggestedAmt);
                                    setFormattedAmount(suggestedAmt.toLocaleString('pt-BR', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }));
                                  }
                                }}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        <FormMessage />
                    </FormItem>
                )}
            />

            {/* ...existing code... Amount Field */}
            <FormField control={form.control} name="amount" render={({ field: _field }) => ( // Rename to _field to unused var check
              <FormItem>
                <FormLabel>Valor</FormLabel>
                <FormControl><Input 
                    type="text" 
                    placeholder="0,00" 
                    value={formattedAmount} 
                    onChange={handleAmountChange}
                    inputMode="decimal"
                /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            {/* REMOVED DueDay Field - included in DatePicker */}

            {/* ...existing code... Linked Income Field */}
            {(currentType === "despesa" || currentType === "investimento") && (
              <FormField
                control={form.control}
                name="linked_income_id"
                render={({ field }) => ( 
                  <FormItem>
                    <FormLabel>Vincular à Receita (Opcional)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === NONE_VALUE_MARKER ? null : value)}
                      value={field.value === null || field.value === undefined ? NONE_VALUE_MARKER : String(field.value)}
                      disabled={isLoading || availableIncomes.length === 0 && (field.value === null || field.value === undefined || field.value === NONE_VALUE_MARKER) }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={availableIncomes.length === 0 ? "Nenhuma receita neste período" : "Selecione uma receita"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE_MARKER}>Nenhuma</SelectItem>
                        {availableIncomes.map((income) => (
                          <SelectItem key={income.id} value={String(income.id)}>
                            {income.category} - R$ {Number(income.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {income.description ? ` (${income.description})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* ...existing code... Recurring Fields */}
            <div className="space-y-4 mt-4">
              <FormField control={form.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel>Transação Recorrente</FormLabel>
                  <FormMessage />
                </FormItem>
              )} />
              {form.watch("isRecurring") && (
                <FormField control={form.control} name="recurringMonths" render={({ field: _field }) => ( // Rename to _field
                  <FormItem>
                    <FormLabel>Duração (meses)</FormLabel>
                    <FormControl><Input type="text" placeholder="1-60" value={recurringMonthsInput} onChange={handleRecurringMonthsChange} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? "Adicionando..." : "Adicionar Transação"}</Button>
          </form>
        </Form>
      </div>

     {/* ...existing code... Dialogs */}
      <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Nova Categoria de {currentType}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-category-name-dialog" className="text-right col-span-1">
                Nome
              </Label>
              <Input 
                id="new-category-name-dialog" 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)} 
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsNewCategoryDialogOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleAddCategory} disabled={!newCategory.trim()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}