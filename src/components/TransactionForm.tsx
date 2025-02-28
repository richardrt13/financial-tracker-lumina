import React, { useState, useEffect } from 'react';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Plus } from "lucide-react";
import { supabase } from '@/lib/supabase'; // Importe o cliente do Supabase
import { transactionEvents } from '@/lib/transactionEvents';
import { toast } from "@/components/ui/use-toast"; // Opcional: para notificações
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);
const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

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
});

type Transaction = {
  id?: number;
  year: string;
  month: string;
  type: "receita" | "despesa" | "investimento";
  category: string;
  amount: number;
  user_id: string;
  created_at?: Date;
  is_completed?: boolean;
};

export function TransactionForm() {
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categories, setCategories] = useState(defaultCategories);
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // Track the current transaction type
  const [currentType, setCurrentType] = useState<"receita" | "despesa" | "investimento">("receita");
  // Add state for recurring months input
  const [recurringMonthsInput, setRecurringMonthsInput] = useState<string>("1");

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
    },
  });

  // Update current type when form type changes
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        setCurrentType(value.type as "receita" | "despesa" | "investimento");
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para adicionar transações.",
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
        // Transações sempre não completadas por padrão
        is_completed: false,
      };
      
      if (values.isRecurring) {
        const transactions = [];
        let currentMonth = months.indexOf(values.month);
        let currentYear = parseInt(values.year);
        
        for (let i = 0; i < recurringMonths; i++) {
          transactions.push({
            ...baseTransaction,
            year: String(currentYear),
            month: months[currentMonth],
            // Todas as transações iniciam como não completadas
            is_completed: false,
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
          // Transação não completada por padrão
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
        year: String(new Date().getFullYear()),
        month: months[new Date().getMonth()],
        type: currentType, // Mantém o tipo atual ao invés de resetar para "receita"
        category: "",
        amount: 0,
        isRecurring: false,
        recurringMonths: "1",
      });
      
      // Reset the recurring months input
      setRecurringMonthsInput("1");
      
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
            render={({ field: { onChange, ...field } }) => (
              <FormItem>
                <FormLabel>Valor</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder="0,00"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value.replace(",", ".");
                      onChange(value);
                    }}
                  />
                </FormControl>
                <FormMessage />
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
                    <FormLabel htmlFor="recurring-switch" className="cursor-pointer">
                      Transação Recorrente
                    </FormLabel>
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
                        min="1"
                        max="60"
                        value={recurringMonthsInput}
                        onChange={handleRecurringMonthsChange}
                        onBlur={() => {
                          // Ao perder o foco, se o campo estiver vazio, definir valor mínimo
                          if (recurringMonthsInput === '') {
                            setRecurringMonthsInput("1");
                            form.setValue("recurringMonths", "1");
                          }
                        }}
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
            {isLoading ? "Salvando..." : "Adicionar Transação"}
          </Button>
        </form>
      </Form>

      <Dialog open={isNewCategoryDialogOpen} onOpenChange={setIsNewCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome da categoria"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewCategoryDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCategory}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
