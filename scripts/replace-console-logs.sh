#!/bin/bash

# Script para substituir console.log/error/warn por logger equivalente
# Uso: ./scripts/replace-console-logs.sh

echo "🔍 Procurando por console.log/error/warn no código..."

# Contador
COUNT=0

# Encontrar todos os arquivos TypeScript/TSX
find src -type f \( -name "*.ts" -o -name "*.tsx" \) | while read file; do
  # Verificar se o arquivo contém console.
  if grep -q "console\." "$file"; then
    echo "📝 Processando: $file"
    
    # Adicionar import do logger se não existir
    if ! grep -q "import.*logger.*from.*@/lib/logger" "$file"; then
      # Encontrar a última linha de import
      last_import=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
      
      if [ ! -z "$last_import" ]; then
        # Adicionar import após o último import
        sed -i.bak "${last_import}a\\
import { logger } from '@/lib/logger';
" "$file"
        echo "  ✅ Adicionado import do logger"
      fi
    fi
    
    # Substituir console.log por logger.log
    sed -i.bak 's/console\.log(/logger.log(/g' "$file"
    
    # Substituir console.error por logger.error
    sed -i.bak 's/console\.error(/logger.error(/g' "$file"
    
    # Substituir console.warn por logger.warn
    sed -i.bak 's/console\.warn(/logger.warn(/g' "$file"
    
    # Substituir console.info por logger.info
    sed -i.bak 's/console\.info(/logger.info(/g' "$file"
    
    # Substituir console.debug por logger.debug
    sed -i.bak 's/console\.debug(/logger.debug(/g' "$file"
    
    # Remover arquivo de backup
    rm -f "${file}.bak"
    
    COUNT=$((COUNT + 1))
    echo "  ✅ Substituições concluídas"
  fi
done

echo ""
echo "✨ Processo concluído!"
echo "📊 Total de arquivos modificados: $COUNT"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Revise as mudanças com: git diff"
echo "   2. Teste o aplicativo: npm run dev"
echo "   3. Se algo der errado: git checkout ."
