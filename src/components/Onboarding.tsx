import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, Target, Wallet, TrendingUp, BarChart3, Brain, Calendar, Sparkles, PartyPopper } from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: { monthlyIncome?: number; topCategories?: string[] }) => void;
}

const CATEGORY_OPTIONS = [
  'Alimentação', 'Moradia', 'Transporte', 'Lazer',
  'Saúde', 'Educação', 'Vestuário', 'Assinaturas',
  'Mercado', 'Delivery', 'Investimentos', 'Outros',
];

const STEPS = [
  { icon: Sparkles, title: 'Bem-vindo ao Spendly!', subtitle: 'Seu controle financeiro inteligente e amigável.', emoji: '👋' },
  { icon: Wallet, title: 'Qual sua renda mensal?', subtitle: 'Nos ajuda a criar insights personalizados.', emoji: '💰' },
  { icon: TrendingUp, title: 'Onde você mais gasta?', subtitle: 'Selecione as categorias que se aplicam.', emoji: '🛒' },
  { icon: PartyPopper, title: 'Tudo pronto!', subtitle: 'Vamos começar essa jornada juntos.', emoji: '🎉' },
];

const FEATURES = [
  { icon: BarChart3, label: 'Dashboard visual com gráficos', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { icon: Brain, label: 'IA que analisa seus gastos', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { icon: Target, label: 'Metas com projeções inteligentes', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { icon: Calendar, label: 'Calendário de contas e vencimentos', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const toggleCategory = (cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onComplete({
      monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
      topCategories: selectedCategories.length > 0 ? selectedCategories : undefined,
    });
  };

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 bg-background/60 glass flex items-center justify-center p-4">
      {/* Decorative blobs */}
      <div className="absolute top-20 left-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl animate-pulse-soft" />
      <div className="absolute bottom-20 right-20 w-56 h-56 bg-accent/10 rounded-full blur-3xl animate-pulse-soft" style={{animationDelay: '1s'}} />

      <div className="w-full max-w-md bg-card rounded-3xl border shadow-2xl overflow-hidden animate-fade-in-scale relative">
        <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-accent" />

        <div className="p-8">
          {/* Progress */}
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${
                i === step ? 'w-10 bg-primary' : i < step ? 'w-4 bg-primary/40' : 'w-4 bg-muted'
              }`} />
            ))}
          </div>

          {/* Emoji + Icon */}
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="text-5xl animate-bounce-gentle">{currentStep.emoji}</div>
              <div className="absolute -bottom-1 -right-2 w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center mb-1 tracking-tight">{currentStep.title}</h2>
          <p className="text-muted-foreground text-center text-sm mb-8">{currentStep.subtitle}</p>

          <div key={step} className="animate-fade-in">
            {step === 0 && (
              <div className="space-y-2.5 mb-8">
                {FEATURES.map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40 hover:bg-muted/70 transition-colors">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${feature.color}`}>
                      <feature.icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-sm font-medium">{feature.label}</span>
                  </div>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="mb-8">
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">R$</span>
                  <Input
                    type="number"
                    placeholder="5.000"
                    value={monthlyIncome}
                    onChange={e => setMonthlyIncome(e.target.value)}
                    className="pl-12 h-14 text-xl font-bold text-center rounded-2xl"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mt-3">Pode alterar depois nas configurações</p>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-wrap gap-2 justify-center mb-8">
                {CATEGORY_OPTIONS.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                    className={`cursor-pointer text-sm py-2 px-4 rounded-full transition-all duration-200 ${
                      selectedCategories.includes(cat)
                        ? 'shadow-sm scale-105'
                        : 'hover:bg-muted/80 hover:scale-105'
                    }`}
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="mb-8 text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  <Sparkles className="h-4 w-4" />
                  Configuração concluída!
                </div>
                <p className="text-sm text-muted-foreground">
                  Use o assistente <strong>Spendly AI</strong> no dashboard para insights financeiros personalizados.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="ghost" size="icon" onClick={() => setStep(s => s - 1)} className="shrink-0 rounded-xl h-12 w-12">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            {step > 0 && step < STEPS.length - 1 && (
              <Button variant="ghost" onClick={() => onComplete({})} className="flex-1 text-muted-foreground rounded-xl h-12">
                Pular
              </Button>
            )}
            <Button onClick={handleNext} className="flex-1 h-12 gap-2 font-semibold rounded-xl text-base">
              {step === STEPS.length - 1 ? 'Começar!' : 'Continuar'}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
