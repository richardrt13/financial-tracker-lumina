import { useState, useRef, useEffect, ReactNode, DragEvent } from 'react';
import { GripVertical } from 'lucide-react';
import type { Budget } from '@/hooks/useBudgets';

interface BudgetDragAndDropProps {
  budgets: Budget[];
  onReorder: (newOrder: Budget[]) => void;
  children: (budget: Budget, isDragging: boolean) => ReactNode;
}

export function BudgetDragAndDrop({ budgets, onReorder, children }: BudgetDragAndDropProps) {
  const [draggedItem, setDraggedItem] = useState<Budget | null>(null);
  const [localBudgets, setLocalBudgets] = useState<Budget[]>(budgets);
  const ghostElementRef = useRef<HTMLDivElement | null>(null);

  // Update local budgets when props change
  useEffect(() => {
    setLocalBudgets(budgets);
  }, [budgets]);

  const handleDragStart = (e: DragEvent<HTMLDivElement>, budget: Budget) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem(budget);

    // Create custom drag image
    const ghostElement = document.createElement('div');
    ghostElement.innerHTML = `
      <div style="
        padding: 8px 12px;
        background-color: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        width: 200px;
        font-size: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
          <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
        </svg>
        ${budget.name}
      </div>
    `;
    ghostElement.style.position = 'absolute';
    ghostElement.style.top = '-1000px';
    document.body.appendChild(ghostElement);
    ghostElementRef.current = ghostElement;

    const firstElement = ghostElement.firstElementChild as HTMLElement;
    if (firstElement) {
      e.dataTransfer.setDragImage(firstElement, 15, 15);
    }

    // Remove ghost element after a short delay
    setTimeout(() => {
      if (ghostElementRef.current && document.body.contains(ghostElementRef.current)) {
        document.body.removeChild(ghostElementRef.current);
        ghostElementRef.current = null;
      }
    }, 0);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, targetBudget: Budget) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!draggedItem || draggedItem.id === targetBudget.id) return;

    // Reorder items visually
    const draggedIndex = localBudgets.findIndex((b: Budget) => b.id === draggedItem.id);
    const targetIndex = localBudgets.findIndex((b: Budget) => b.id === targetBudget.id);

    if (draggedIndex === targetIndex) return;

    const newBudgets = [...localBudgets];
    const [removed] = newBudgets.splice(draggedIndex, 1);
    newBudgets.splice(targetIndex, 0, removed);

    setLocalBudgets(newBudgets);
  };

  const handleDragEnd = () => {
    if (draggedItem) {
      // Save the new order
      onReorder(localBudgets);
    }
    setDraggedItem(null);

    // Cleanup ghost element if still exists
    if (ghostElementRef.current && document.body.contains(ghostElementRef.current)) {
      document.body.removeChild(ghostElementRef.current);
      ghostElementRef.current = null;
    }
  };

  return (
    <div className="space-y-2">
      {localBudgets.map((budget: Budget) => (
        <div
          key={budget.id}
          draggable
          onDragStart={(e: DragEvent<HTMLDivElement>) => handleDragStart(e, budget)}
          onDragOver={(e: DragEvent<HTMLDivElement>) => handleDragOver(e, budget)}
          onDragEnd={handleDragEnd}
          className={`
            flex items-center gap-2 p-2 rounded-md border bg-card cursor-move
            transition-opacity duration-200
            ${draggedItem?.id === budget.id ? 'opacity-50' : 'opacity-100'}
            hover:bg-accent
          `}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {children(budget, draggedItem?.id === budget.id)}
          </div>
        </div>
      ))}
    </div>
  );
}
