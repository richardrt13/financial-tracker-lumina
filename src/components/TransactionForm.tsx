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
});

// Defina o tipo para as transações
type Transaction = {
  id?: number;
  year: string;
  month: string;
  type: "receita" | "despesa" | "investimento";
  category: string;
  amount: number;
  user_id: string; // Assumindo que você está usando autenticação
  created_at?: Date;
};

export function TransactionForm() {
  const [isNewCategoryDialogOpen, setIsNewCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categories, setCategories] = useState(defaultCategories);
  const [isLoading, setIsLoading] = useState(false);

  // Verifica se o usuário está autenticado
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Recupera a sessão do usuário
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUserId(session.user.id);
      }
    };
    
    checkUser();
    
    // Opcional: recuperar categorias personalizadas do usuário da base de dados
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
        // Transformar categorias do banco para o formato usado no estado
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
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!userId) {
      // Opcional: mostrar mensagem de erro ou redirecionar para login
      toast({
        title: "Erro",
        description: "Você precisa estar logado para adicionar transações.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Converte o objeto de valores do formulário para o tipo Transaction
      const transaction: Omit<Transaction, 'id' | 'created_at'> = {
        year: values.year,
        month: values.month,
        type: values.type,
        category: values.category,
        amount: Number(values.amount),
        user_id: userId,
      };

      // Insere a transação no Supabase
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

      // Limpa o formulário e notifica o usuário
      form.reset({
        year: String(new Date().getFullYear()),
        month: months[new Date().getMonth()],
        type: "receita",
        category: "",
        amount: 0,
      });
      transactionEvents.notify();
      toast({
        title: "Sucesso",
        description: "Transação adicionada com sucesso!",
      });
      
      // Aqui você pode emitir um evento ou usar algum gerenciador de estado
      // para atualizar a lista de transações na interface
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
    
    const type = form.watch("type");
    
    // Adiciona localmente
    setCategories(prev => ({
      ...prev,
      [type]: [...prev[type], newCategory.trim()]
    }));
    
    // Se o usuário estiver logado, salva no banco de dados
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
    
    // Seleciona a nova categoria no formulário
    form.setValue("category", newCategory.trim());
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
                      {categories[form.watch("type") as keyof typeof categories]?.map((category) => (
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
