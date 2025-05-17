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

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const getDaysInMonth = (month: string, year: string) => {
  const monthIndex = months.indexOf(month);
  return new Date(parseInt(year), monthIndex + 1, 0).getDate();
};

const defaultCategories = {
  receita: ["Salário", "Freelance", "Investimentos", "Outros"],
  despesa: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Outros"],
  investimento: ["Ações", "Fundos", "Renda Fixa", "Criptomoedas", "Outros"]
};

const formSchema = z.object({
  year: z.string(),
  month: z.string(),
  type: z.enum(["receita", "despesa", "investimento"]),
  category: z.string(),
  amount: z.number().or(z.string().transform(val => {
    const parsed = Number(val.replace(",", "."));
    if (isNaN(parsed)) return 0;
    return parsed;
  })),
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
  const [maxDaysInMonth, setMaxDaysInMonth] = useState<number>(31);
  const [formattedAmount, setFormattedAmount] = useState<string>("0,00");

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
    
    const fetchUserCategories = async () => {
      if (!userId) return;
      
      const { data: userCategories, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', userId);
        
      if (error) {
        console.error('Erro ao buscar categorias:', error);
        return;
      }
      
      if (userCategories && userCategories.length > 0) {
        const userCats = {
          receita: [...defaultCategories.receita],
          despesa: [...defaultCategories.despesa],
          investimento: [...defaultCategories.investimento]
        };
        
        userCategories.forEach(cat => {
          if (!userCats[cat.type].includes(cat.name)) {
            userCats[cat.type].push(cat.name);
          }
        });
        
        setCategories(userCats);
      }
    };
    
    if (userId) {
      fetchUserCategories();
    }
  }, [userId]);

  useEffect(() => {
    if (budgetId) {
      form.reset({
        year: String(new Date().getFullYear()),
        month: months[new Date().getMonth()],
        type: "receita",
        category: "",
        amount: 0,
        isRecurring: false,
        recurringMonths: "1",
        dueDay: "",
      });
      setFormattedAmount("0,00");
    }
  }, [budgetId, form]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        setCurrentType(value.type as "receita" | "despesa" | "investimento");
      }
      
      if ((name === 'month' && value.month) || (name === 'year' && value.year)) {
        if (value.month) setCurrentMonth(value.month);
        if (value.year) setCurrentYear(value.year);
        
        if (value.month && value.year) {
          const maxDays = getDaysInMonth(value.month, value.year);
          setMaxDaysInMonth(maxDays);
          
          const currentDueDay = form.getValues("dueDay");
          if (currentDueDay && parseInt(currentDueDay) > maxDays) {
            form.setValue("dueDay", String(maxDays));
            setDueDayInput(String(maxDays));
          }
        }
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

  useEffect(() => {
    const maxDays = getDaysInMonth(currentMonth, currentYear);
    setMaxDaysInMonth(maxDays);
  }, [currentMonth, currentYear]);

  const handleVoiceRecognition = (transactionInfo: any) => {
    if (transactionInfo.type) {
      form.setValue("type", transactionInfo.type);
      setCurrentType(transactionInfo.type);
    }
    
    if (transactionInfo.category) {
      form.setValue("category", transactionInfo.category);
    }
    
    if (transactionInfo.amount > 0) {
      form.setValue("amount", transactionInfo.amount);
      const formatted = transactionInfo.amount.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      setFormattedAmount(formatted);
    }
    
    if (transactionInfo.month && months.includes(transactionInfo.month)) {
      form.setValue("month", transactionInfo.month);
      setCurrentMonth(transactionInfo.month);
    }
    
    if (transactionInfo.year) {
      form.setValue("year", transactionInfo.year);
      setCurrentYear(transactionInfo.year);
    }
    
    if (transactionInfo.isRecurring !== undefined) {
      form.setValue("isRecurring", transactionInfo.isRecurring);
      
      if (transactionInfo.isRecurring && transactionInfo.recurringMonths) {
        form.setValue("recurringMonths", transactionInfo.recurringMonths);
        setRecurringMonthsInput(transactionInfo.recurringMonths);
      }
    }
    
    if (transactionInfo.dueDay) {
      const maxDays = getDaysInMonth(
        transactionInfo.month || currentMonth, 
        transactionInfo.year || currentYear
      );
      
      const dueDay = parseInt(transactionInfo.dueDay);
      if (dueDay > 0 && dueDay <= maxDays) {
        form.setValue("dueDay", String(dueDay));
        setDueDayInput(String(dueDay));
      }
    }
    
    const maxDays = getDaysInMonth(
      transactionInfo.month || currentMonth,
      transactionInfo.year || currentYear
    );
    setMaxDaysInMonth(maxDays);
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para adicionar transações.",
        variant: "destructive"
      });
      return;
    }
    
    if (!budgetId) {
      toast({
        title: "Erro",
        description: "Selecione um orçamento válido.",
        variant: "destructive"
      });
      return;
    }
    
    const recurringMonths = values.recurringMonths === '' ? 1 : 
                         (typeof values.recurringMonths === 'string' ? 
                          parseInt(values.recurringMonths) : values.recurringMonths);
    
    if (values.isRecurring && (isNaN(recurringMonths) || recurringMonths < 1 || recurringMonths > 60)) {
      toast({
        title: "Erro",
        description: "A duração deve ser entre 1 e 60 meses",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const baseTransaction = {
        type: values.type,
        category: values.category,
        amount: Number(values.amount),
        user_id: userId,
        budget_id: budgetId,
        is_completed: false,
        due_day: values.dueDay,
      };
      
      if (values.isRecurring) {
        const transactions = [];
        let currentMonthIdx = months.indexOf(values.month);
        let currentYearVal = parseInt(values.year);
        
        for (let i = 0; i < recurringMonths; i++) {
          let adjustedDueDay = values.dueDay;
          
          if (adjustedDueDay) {
            const maxDays = getDaysInMonth(months[currentMonthIdx], String(currentYearVal));
            if (parseInt(adjustedDueDay) > maxDays) {
              adjustedDueDay = String(maxDays);
            }
          }
          
          transactions.push({
            ...baseTransaction,
            year: String(currentYearVal),
            month: months[currentMonthIdx],
            is_completed: false,
            due_day: adjustedDueDay,
          });
          
          currentMonthIdx++;
          if (currentMonthIdx > 11) {
            currentMonthIdx = 0;
            currentYearVal++;
          }
        }
        
        const { error } = await supabase
          .from('transactions')
          .insert(transactions);
          
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: `${recurringMonths} transações recorrentes adicionadas com sucesso!`,
        });
      } else {
        const transaction = {
          ...baseTransaction,
          year: values.year,
          month: values.month,
        };
        
        const { error } = await supabase
          .from('transactions')
          .insert(transaction);
        
        if (error) throw error;
        
        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
        });
      }
      
      form.reset({
        year: values.year, 
        month: values.month, 
        type: currentType,
        category: values.category,
        amount: 0,
        isRecurring: false,
        recurringMonths: "1",
        dueDay: "",
      });
      
      setRecurringMonthsInput("1");
      setDueDayInput("");
      setFormattedAmount("0,00");
      
      transactionEvents.notify();
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    const type = currentType;
    
    setCategories(prev => ({
      ...prev,
      [type]: [...prev[type], newCategory.trim()]
    }));
    
    if (userId) {
      try {
        const { error } = await supabase
          .from('categories')
          .insert({
            name: newCategory.trim(),
            type,
            user_id: userId
          });
          
        if (error) {
          console.error('Erro ao salvar categoria:', error);
        }
      } catch (error) {
        console.error('Erro inesperado ao salvar categoria:', error);
      }
    }
    
    setNewCategory("");
    setIsNewCategoryDialogOpen(false);
    form.setValue("category", newCategory.trim());
  };

  const handleRecurringMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRecurringMonthsInput(e.target.value);
    form.setValue("recurringMonths", e.target.value);
  };

  const handleDueDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '' || /^\d+$/.test(value)) {
      setDueDayInput(value);
      
      if (value !== '' && parseInt(value) > 0) {
        const dayValue = parseInt(value);
        if (dayValue > maxDaysInMonth) {
          setDueDayInput(String(maxDaysInMonth));
          form.setValue("dueDay", String(maxDaysInMonth));
        } else {
          form.setValue("dueDay", value);
        }
      } else {
        form.setValue("dueDay", value);
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    
    if (value === "") {
      setFormattedAmount("0,00");
      form.setValue("amount", "0");
      return;
    }
    
    const numericValue = parseInt(value) / 100;
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setFormattedAmount(formatted);
    form.setValue("amount", numericValue.toString());
  };

  return (
    <>
    
      <VoiceCommandTransaction
        onTransactionRecognized={handleVoiceRecognition} // This populates the form
        onSubmitTransaction={async (transactionDataFromVoice) => {
          // This function is called by VoiceCommandTransaction.tsx after onTransactionRecognized
          // The actual form submission (onSubmit) in TransactionForm.tsx is triggered by the user clicking the "Adicionar Transação" button
          // OR if you want to auto-submit from voice, this is where it would happen.
          // The current structure in VoiceCommandTransaction.tsx calls onTransactionRecognized,
          // then the form is populated. The user then typically clicks "submit" on the main form.
          // If you want voice to *also* submit, you would call your form's submit logic here.
          // However, the provided VoiceCommandTransaction now calls onSubmitTransaction directly in processVoiceCommand.

          // The new processVoiceCommand in VoiceCommandTransaction now directly calls onTransactionRecognized
          // and expects the parent component (TransactionForm) to handle the submission via its own mechanisms
          // (e.g., user clicks submit button after form is populated by voice).
          // The prop onSubmitTransaction in VoiceCommandTransaction is no longer strictly necessary
          // if the flow is: Voice -> Populates Form -> User Clicks Submit.
          // However, if VoiceCommandTransaction's processVoiceCommand should also *trigger* the submission,
          // then the logic passed here needs to correctly call the form's submission.

          // Let's re-evaluate: The original VoiceCommandTransaction's processVoiceCommand had:
          // onTransactionRecognized(transactionInfo);
          // await onSubmitTransaction(transactionInfo);
          // This means it *did* try to submit.

          // So, the `onSubmitTransaction` prop should indeed contain the logic to submit.
          // The Zod parsing needs to happen with the data from Gemini.

          const rawDataForZod = {
              year: transactionDataFromVoice.year,
              month: transactionDataFromVoice.month,
              type: transactionDataFromVoice.type,
              category: transactionDataFromVoice.category,
              amount: transactionDataFromVoice.amount, // amount is already number
              isRecurring: transactionDataFromVoice.isRecurring,
              recurringMonths: transactionDataFromVoice.recurringMonths, // string
              dueDay: transactionDataFromVoice.dueDay, // string, Zod handles "" -> null
          };

          try {
              const validatedData = formSchema.parse(rawDataForZod); // formSchema is in TransactionForm
              await onSubmit(validatedData); // onSubmit is the main submission function in TransactionForm
          } catch (zodError: any) {
              console.error("Zod validation error for voice command data (Gemini):", zodError);
              // Display Zod errors to the user via toast
              let errorMessages = "Erro de validação: ";
              if (zodError.errors && zodError.errors.length > 0) {
                  errorMessages += zodError.errors.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
              } else {
                  errorMessages += "Verifique os dados do comando de voz.";
              }
              toast({
                title: "Erro ao Validar Dados do Comando de Voz",
                description: errorMessages,
                variant: "destructive",
              });
          }
        }}
      />

      
      <div className="mt-6 border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Formulário Manual</h3>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
            <div className="flex gap-4">
              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Ano</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o ano" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={String(year)}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="month"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Mês</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o mês" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month} value={month}>
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select 
                    onValueChange={(value: "receita" | "despesa" | "investimento") => {
                      field.onChange(value);
                      setCurrentType(value); // Atualiza o tipo atual
                      form.setValue("category", "");
                    }} 
                    defaultValue={field.value}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="receita">Receita</SelectItem>
                      <SelectItem value="despesa">Despesa</SelectItem>
                      <SelectItem value="investimento">Investimento</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 items-end">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Categoria</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories[currentType]?.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsNewCategoryDialogOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="0,00"
                      value={formattedAmount}
                      onChange={handleAmountChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dia de vencimento */}
            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Vencimento (opcional)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={`1-${maxDaysInMonth}`}
                      value={dueDayInput}
                      onChange={handleDueDayChange}
                    />
                  </FormControl>
                  <FormMessage />
                  {maxDaysInMonth < 31 && (
                    <p className="text-xs text-muted-foreground">
                      Dias válidos para {currentMonth}: 1-{maxDaysInMonth}
                    </p>
                  )}
                </FormItem>
              )}
            />

            <div className="space-y-4 mt-4">
              <div className="flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          id="recurring-switch"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Transação Recorrente</FormLabel>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {form.watch("isRecurring") && (
                <FormField
                  control={form.control}
                  name="recurringMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração (meses)</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Entre 1 e 60 meses"
                          value={recurringMonthsInput}
                          onChange={handleRecurringMonthsChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Adicionando..." : "Adicionar Transação"}
            </Button>
          </form>
        </Form>
      </div>
      <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Categoria de {currentType === "receita" ? "Receita" : currentType === "despesa" ? "Despesa" : "Investimento"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right col-span-1">
                Nome
              </FormLabel>
              <Input
                id="name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsNewCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddCategory} disabled={!newCategory.trim()}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}