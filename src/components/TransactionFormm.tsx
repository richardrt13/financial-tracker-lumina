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

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

// Função para obter o número máximo de dias em um mês específico
const getDaysInMonth = (month, year) => {
  // Converte o nome do mês para o índice (0-11)
  const monthIndex = months.indexOf(month);
  // Retorna o último dia do mês (passando 0 como dia do próximo mês)
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

type Transaction = {
  id?: number;
  year: string;
  month: string;
  type: "receita" | "despesa" | "investimento";
  category: string;
  amount: number;
  user_id: string;
  budget_id: string; // Novo campo para o ID do orçamento
  created_at?: Date;
  is_completed?: boolean;
  due_day?: number | null;
};

// Adicionar propriedade budgetId ao componente
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

  // Resetar form quando o orçamento mudar
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

  // Update current type when form type changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        setCurrentType(value.type as "receita" | "despesa" | "investimento");
      }
      
      // Atualizar mês e ano atual quando mudam, e calcular dias máximos
      if ((name === 'month' && value.month) || (name === 'year' && value.year)) {
        if (value.month) setCurrentMonth(value.month);
        if (value.year) setCurrentYear(value.year);
        
        // Recalcular dias máximos no mês
        if (value.month && value.year) {
          const maxDays = getDaysInMonth(value.month, value.year);
          setMaxDaysInMonth(maxDays);
          
          // Se o dia de vencimento atual for maior que o máximo, ajuste-o
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

  // Calcular dias máximos no mês inicial
  useEffect(() => {
    const maxDays = getDaysInMonth(currentMonth, currentYear);
    setMaxDaysInMonth(maxDays);
  }, [currentMonth, currentYear]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
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
    
    // Validate recurringMonths before submission
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
        budget_id: budgetId, // Adicionar o ID do orçamento
        is_completed: false,
        due_day: values.dueDay,
      };
      
      if (values.isRecurring) {
        const transactions = [];
        let currentMonth = months.indexOf(values.month);
        let currentYear = parseInt(values.year);
        
        for (let i = 0; i < recurringMonths; i++) {
          // Verificar e ajustar o dia de vencimento para cada mês
          let adjustedDueDay = values.dueDay;
          
          if (adjustedDueDay) {
            const maxDays = getDaysInMonth(months[currentMonth], String(currentYear));
            if (parseInt(adjustedDueDay) > maxDays) {
              adjustedDueDay = String(maxDays);
            }
          }
          
          transactions.push({
            ...baseTransaction,
            year: String(currentYear),
            month: months[currentMonth],
            is_completed: false,
            due_day: adjustedDueDay,
          });
          
          currentMonth++;
          if (currentMonth > 11) {
            currentMonth = 0;
            currentYear++;
          }
        }
        
        const { data, error } = await supabase
          .from('transactions')
          .insert(transactions)
          .select();
          
        if (error) {
          console.error('Erro ao adicionar transações recorrentes:', error);
          toast({
            title: "Erro",
            description: error.message || "Não foi possível salvar as transações. Tente novamente mais tarde.",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Sucesso",
          description: `${recurringMonths} transações recorrentes adicionadas com sucesso!`,
        });
      } else {
        const transaction = {
          ...baseTransaction,
          year: values.year,
          month: values.month,
          is_completed: false,
        };
        
        const { data, error } = await supabase
          .from('transactions')
          .insert(transaction)
          .select();
        
        if (error) {
          console.error('Erro ao adicionar transação:', error);
          toast({
            title: "Erro",
            description: error.message || "Não foi possível salvar a transação. Tente novamente mais tarde.",
            variant: "destructive"
          });
          return;
        }
        
        toast({
          title: "Sucesso",
          description: "Transação adicionada com sucesso!",
        });
      }
      // Reset the form
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
            
      // Reset the recurring months input
      setRecurringMonthsInput("1");
      // Reset due day input
      setDueDayInput("");
      // Reset the amount input to 0,00
      setFormattedAmount("0,00");
      
      transactionEvents.notify();
    } catch (error) {
      console.error('Erro inesperado:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar sua solicitação.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    
    const type = currentType; // Usa o tipo atual
    
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

  // Handle recurring months input changes
  const handleRecurringMonthsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permitir campo vazio
    setRecurringMonthsInput(e.target.value);
    
    // Atualizar o valor no formulário
    form.setValue("recurringMonths", e.target.value);
  };

  // Handle due day input changes
  const handleDueDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Permitir campo vazio ou apenas números
    if (value === '' || /^\d+$/.test(value)) {
      setDueDayInput(value);
      
      // Se tem valor e é um número, verifique se é menor que o máximo de dias no mês
      if (value !== '' && parseInt(value) > 0) {
        const dayValue = parseInt(value);
        if (dayValue > maxDaysInMonth) {
          // Se for maior, ajuste para o máximo
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

  // Função para lidar com a mudança no campo de valor monetário
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove todos os caracteres não numéricos
    value = value.replace(/\D/g, "");
    
    // Se estiver vazio, mostrar 0,00
    if (value === "") {
      setFormattedAmount("0,00");
      form.setValue("amount", "0");
      return;
    }
    
    // Converte para número e formata com 2 casas decimais
    const numericValue = parseInt(value) / 100;
    
    // Formata no estilo brasileiro (com vírgula)
    const formatted = numericValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    setFormattedAmount(formatted);
    
    // Atualiza o formulário com o valor numérico
    form.setValue("amount", numericValue.toString());
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Ano</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                <Select onValueChange={(value: "receita" | "despesa" | "investimento") => {
                  field.onChange(value);
                  setCurrentType(value); // Atualiza o tipo atual
                  form.setValue("category", "");
                }} defaultValue={field.value}>
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
