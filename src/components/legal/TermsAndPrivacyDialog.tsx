import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { termsOfService, privacyPolicy } from "./legal-documents";

interface TermsAndPrivacyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export const TermsAndPrivacyDialog = ({
  isOpen,
  onClose,
  onAccept,
}: TermsAndPrivacyDialogProps) => {
  const [accepted, setAccepted] = React.useState(false);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Termos de Serviço e Política de Privacidade</DialogTitle>
          <DialogDescription>
            Por favor, leia e aceite nossos termos antes de continuar.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="terms" className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="terms">Termos de Serviço</TabsTrigger>
            <TabsTrigger value="privacy">Política de Privacidade</TabsTrigger>
          </TabsList>
          
          <TabsContent value="terms" className="flex-1 min-h-0">
            <ScrollArea className="h-[50vh]">
              <div className="prose prose-sm max-w-none p-4">
                {termsOfService.map((section, index) => (
                  <div key={index} className="mb-6">
                    <h2 className="text-xl font-bold mb-2">{section.title}</h2>
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="mb-2 text-sm leading-relaxed">{paragraph}</p>
                    ))}
                    {section.subsections && section.subsections.map((subsection, sIndex) => (
                      <div key={sIndex} className="ml-4 mb-4">
                        <h3 className="text-lg font-semibold mb-1">{subsection.title}</h3>
                        {subsection.content.map((paragraph, pIndex) => (
                          <p key={pIndex} className="mb-2 text-sm leading-relaxed">{paragraph}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="privacy" className="flex-1 min-h-0">
            <ScrollArea className="h-[50vh]">
              <div className="prose prose-sm max-w-none p-4">
                {privacyPolicy.map((section, index) => (
                  <div key={index} className="mb-6">
                    <h2 className="text-xl font-bold mb-2">{section.title}</h2>
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="mb-2 text-sm leading-relaxed">{paragraph}</p>
                    ))}
                    {section.subsections && section.subsections.map((subsection, sIndex) => (
                      <div key={sIndex} className="ml-4 mb-4">
                        <h3 className="text-lg font-semibold mb-1">{subsection.title}</h3>
                        {subsection.content.map((paragraph, pIndex) => (
                          <p key={pIndex} className="mb-2 text-sm leading-relaxed">{paragraph}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center space-x-2 mt-4">
          <Checkbox 
            id="terms" 
            checked={accepted}
            onCheckedChange={(checked) => setAccepted(checked as boolean)}
          />
          <label
            htmlFor="terms"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Eu li e aceito os Termos de Serviço e a Política de Privacidade
          </label>
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <DialogClose asChild>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
          </DialogClose>
          <Button 
            onClick={onAccept} 
            disabled={!accepted}
          >
            Aceitar e Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
