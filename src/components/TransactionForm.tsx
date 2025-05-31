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
  FormLabel, // Este é o FormLabel que depende do FormProvider
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label"; // Este é o Label genérico
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
import { VoiceCommandTransaction } from './VoiceCommandTransaction';
import type { Transaction as TransactionType } from './dashboard/types';

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const NONE_VALUE_MARKER = "__NONE_INCOME_LINK_FORM__";

const getDaysInMonth = (month: string, year: string) => {
  const monthIndex = months.indexOf(month);
  if (monthIndex === -1 || !year || isNaN(parseInt(year))) {
    return 31; // Fallback
  }
  return new Date(parseInt(year), monthIndex + 1, 0).getDate();
};

const defaultCategories = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Contas", "Educação", "Impostos", "Outros"],
  investimento: ["Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Imóveis", "Outros"]
};

const formSchema = z.object({
  year: z.string(),
  month: z.string(),
  type: z.enum(["receita", "despesa", "investimento"]),
  category: z.string().min(1, { message: "Categoria é obrigatória." }),
  amount: z.number().or(z.string().transform(val => {
    const cleanedVal = String(val).replace(/\./g, '').replace(',', '.'); // Primeiro remove pontos (milhar) e depois troca vírgula por ponto
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
  dueDay: z.string().optional().transform(val => {
    if (!val || val === '') return null;
    const parsed = parseInt(val);
    return isNaN(parsed) ? null : parsed;
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
  const [dueDayInput, setDueDayInput] = useState<string>("");
  const [currentMonth, setCurrentMonth] = useState<string>(months[new Date().getMonth()]);
  const [currentYear, setCurrentYear] = useState<string>(String(new Date().getFullYear()));
  const [maxDaysInMonth, setMaxDaysInMonth] = useState<number>(getDaysInMonth(currentMonth, currentYear));
  const [formattedAmount, setFormattedAmount] = useState<string>("0,00");

  const [availableIncomes, setAvailableIncomes] = useState<TransactionType[]>([]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      year: String(new Date().getFullYear()),
      month: months[new Date().getMonth()],
      type: "receita",
      category: "",
      amount: 0,
      isRecurring: false,
      recurringMonths: "1",
      dueDay: "",
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
      const defaultYear = String(new Date().getFullYear());
      const defaultMonth = months[new Date().getMonth()];
      form.reset({
        year: defaultYear,
        month: defaultMonth,
        type: "receita",
        category: "",
        amount: 0,
        isRecurring: false,
        recurringMonths: "1",
        dueDay: "",
        linked_income_id: null,
        description: "",
      });
      setFormattedAmount("0,00");
      setRecurringMonthsInput("1");
      setDueDayInput("");
      setCurrentType("receita");
      setCurrentMonth(defaultMonth);
      setCurrentYear(defaultYear);
      setMaxDaysInMonth(getDaysInMonth(defaultMonth, defaultYear));
    }
  }, [budgetId, form]);

  useEffect(() => {
    const fetchAvailableIncomes = async () => {
      if ((currentType !== 'despesa' && currentType !== 'investimento') || !userId || !budgetId || !currentMonth || !currentYear) {
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
  }, [currentType, currentMonth, currentYear, userId, budgetId]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        setCurrentType(value.type as "receita" | "despesa" | "investimento");
        form.setValue("category", ""); 
        form.setValue("linked_income_id", null); 
      }
      
      let newMaxDays = maxDaysInMonth;
      let monthChanged = false;
      let yearChanged = false;

      if (name === 'month' && value.month && value.month !== currentMonth) {
        setCurrentMonth(value.month);
        monthChanged = true;
      }
      if (name === 'year' && value.year && value.year !== currentYear) {
        setCurrentYear(value.year);
        yearChanged = true;
      }

      if(monthChanged || yearChanged) {
        newMaxDays = getDaysInMonth(value.month || currentMonth, value.year || currentYear);
        setMaxDaysInMonth(newMaxDays);
        const currentDueDayVal = form.getValues("dueDay"); 
        if (currentDueDayVal) {
            const dueDayNum = parseInt(String(currentDueDayVal));
            if (dueDayNum > newMaxDays) {
                form.setValue("dueDay", String(newMaxDays)); 
                setDueDayInput(String(newMaxDays)); 
            }
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, currentMonth, currentYear, maxDaysInMonth]); // Added currentMonth, currentYear, maxDaysInMonth

  const handleVoiceRecognition = (transactionInfo: any) => {
     if (transactionInfo.type) {
      form.setValue("type", transactionInfo.type);
      setCurrentType(transactionInfo.type);
    }
    if (transactionInfo.category) form.setValue("category", transactionInfo.category);
    
    if (transactionInfo.amount > 0) {
        const numericAmount = Number(transactionInfo.amount);
        form.setValue("amount", numericAmount); // Zod expects number here
        const formatted = numericAmount.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        setFormattedAmount(formatted);
    }

    if (transactionInfo.month && months.includes(transactionInfo.month)) {
        form.setValue("month", transactionInfo.month);
        // setCurrentMonth will be updated by form.watch
    }
    if (transactionInfo.year) {
        form.setValue("year", transactionInfo.year);
        // setCurrentYear will be updated by form.watch
    }
    if (transactionInfo.description) form.setValue("description", transactionInfo.description);
    if (transactionInfo.isRecurring !== undefined) {
        form.setValue("isRecurring", transactionInfo.isRecurring);
        if (transactionInfo.isRecurring && transactionInfo.recurringMonths) {
            form.setValue("recurringMonths", String(transactionInfo.recurringMonths));
            setRecurringMonthsInput(String(transactionInfo.recurringMonths));
        }
    }
    if (transactionInfo.dueDay) {
        const maxD = getDaysInMonth(transactionInfo.month || form.getValues("month"), transactionInfo.year || form.getValues("year"));
        const dueDayNum = parseInt(String(transactionInfo.dueDay));
        if (dueDayNum > 0 && dueDayNum <= maxD) {
            form.setValue("dueDay", String(dueDayNum));
            setDueDayInput(String(dueDayNum));
        }
    }
    if (transactionInfo.linked_income_id) {
        form.setValue("linked_income_id", String(transactionInfo.linked_income_id));
    } else {
        form.setValue("linked_income_id", null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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
    
    const amountValue = values.amount; // Zod schema already transformed to number
    if (amountValue <= 0) {
        toast({ title: "Erro", description: "O valor da transação deve ser maior que zero.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      const transactionsToInsert = [];
      let currentMonthIdx = months.indexOf(values.month);
      let currentYearVal = parseInt(values.year);

      for (let i = 0; i < (values.isRecurring ? recurringMonthsNum : 1); i++) {
        let adjustedDueDay = values.dueDay ? parseInt(String(values.dueDay)) : null;
        if (adjustedDueDay) {
          const maxDaysForLoopMonth = getDaysInMonth(months[currentMonthIdx], String(currentYearVal));
          if (adjustedDueDay > maxDaysForLoopMonth) {
            adjustedDueDay = maxDaysForLoopMonth;
          }
        }

        transactionsToInsert.push({
          type: values.type,
          category: values.category,
          amount: amountValue,
          description: values.description || null,
          user_id: userId,
          budget_id: budgetId,
          is_completed: false,
          due_day: adjustedDueDay,
          year: String(currentYearVal),
          month: months[currentMonthIdx],
          linked_income_id: (values.type === 'despesa' || values.type === 'investimento') && values.linked_income_id ? values.linked_income_id : null,
        });

        if (values.isRecurring) {
          currentMonthIdx++;
          if (currentMonthIdx > 11) {
            currentMonthIdx = 0;
            currentYearVal++;
          }
        }
      }

      const { error } = await supabase.from('transactions').insert(transactionsToInsert);
      if (error) throw error;

      toast({ title: "Sucesso", description: `Transação(ões) adicionada(s) com sucesso!` });
      
      const defaultNewYear = String(new Date().getFullYear());
      const defaultNewMonth = months[new Date().getMonth()];
      form.reset({
        year: defaultNewYear, 
        month: defaultNewMonth,
        type: "receita", 
        category: "", 
        amount: 0, 
        isRecurring: false, 
        recurringMonths: "1",
        dueDay: "", 
        linked_income_id: null, 
        description: ""
      });
      setCurrentType("receita"); 
      setCurrentMonth(defaultNewMonth); 
      setCurrentYear(defaultNewYear); 
      setMaxDaysInMonth(getDaysInMonth(defaultNewMonth, defaultNewYear));
      setRecurringMonthsInput("1");
      setDueDayInput("");
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

  const handleDueDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (/^\d+$/.test(value))) {
        let day = parseInt(value);
        if (value === '') {
            setDueDayInput('');
            form.setValue("dueDay", '');
        } else if (!isNaN(day) && day >= 1) {
            if (day > maxDaysInMonth) day = maxDaysInMonth;
            setDueDayInput(String(day));
            form.setValue("dueDay", String(day));
        } else if (value.length <= 2 && (value === "0" || value === "")) { 
            setDueDayInput(value);
            form.setValue("dueDay", ''); 
        } else if (value.length <=2 && /^\d+$/.test(value) && parseInt(value) === 0) {
            setDueDayInput(value); // Allow "0" to be typed temporarily
            form.setValue("dueDay", ''); // Keep form value empty
        }

    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    let digits = rawValue.replace(/[^\d]/g, ""); // Remove todos não-dígitos

    if (digits === "") {
        setFormattedAmount("0,00");
        form.setValue("amount", "0"); // Zod schema handles transformation to number
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
      form.setValue("amount", "0");
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
          const rawDataForZod = {
            year: transactionDataFromVoice.year || currentYear,
            month: transactionDataFromVoice.month || currentMonth,
            type: transactionDataFromVoice.type,
            category: transactionDataFromVoice.category,
            amount: transactionDataFromVoice.amount, // amount is already number
            isRecurring: transactionDataFromVoice.isRecurring,
            recurringMonths: String(transactionDataFromVoice.recurringMonths || "1"),
            dueDay: transactionDataFromVoice.dueDay ? String(transactionDataFromVoice.dueDay) : "",
            linked_income_id: transactionDataFromVoice.linked_income_id || null,
            description: transactionDataFromVoice.description || ""
          };
          try {
            const validatedData = formSchema.parse(rawDataForZod);
            await onSubmit(validatedData);
          } catch (zodError: any) {
            console.error("Zod validation error for voice command data:", zodError.errors);
            let errorMessages = zodError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join('; ') || "Verifique os dados do comando de voz.";
            toast({ title: "Erro ao Validar Dados por Voz", description: errorMessages, variant: "destructive" });
          }
        }}
      />
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Formulário Manual</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
            <div className="flex gap-4">
              <FormField control={form.control} name="year" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Ano</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || currentYear} defaultValue={currentYear}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger></FormControl>
                    <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="month" render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Mês</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || currentMonth} defaultValue={currentMonth}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger></FormControl>
                    <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
            </div>

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
            
            <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Descrição (Opcional)</FormLabel>
                        <FormControl>
                            <Input placeholder="Ex: Compra semanal, Salário mensal" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField control={form.control} name="amount" render={({ field }) => ( // field.value will be number after Zod transform, but raw input is string
              <FormItem>
                <FormLabel>Valor</FormLabel>
                <FormControl><Input 
                    type="text" 
                    placeholder="0,00" 
                    value={formattedAmount} 
                    onChange={handleAmountChange}
                    inputMode="decimal" // Helps with mobile keyboards
                /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            
            <FormField control={form.control} name="dueDay" render={({ field }) => (
              <FormItem>
                <FormLabel>Dia de Vencimento (opcional)</FormLabel>
                <FormControl><Input type="text" placeholder={`1-${maxDaysInMonth}`} value={dueDayInput} onChange={handleDueDayChange} /></FormControl>
                {maxDaysInMonth < 31 && currentMonth && <p className="text-xs text-muted-foreground">Dias válidos para {currentMonth}: 1-{maxDaysInMonth}</p>}
                <FormMessage />
              </FormItem>
            )} />

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

            <div className="space-y-4 mt-4">
              <FormField control={form.control} name="isRecurring" render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  <FormLabel>Transação Recorrente</FormLabel>
                  <FormMessage />
                </FormItem>
              )} />
              {form.watch("isRecurring") && (
                <FormField control={form.control} name="recurringMonths" render={({ field }) => (
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