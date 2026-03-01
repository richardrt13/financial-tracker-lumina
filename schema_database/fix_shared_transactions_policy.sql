-- Fix for Shared Transactions Visibility
-- This script updates the Row Level Security (RLS) policies for the 'transactions' table
-- to ensure that users can see transactions in budgets shared with them.

-- 1. Enable RLS (just in case)
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
-- Note: We attempt to drop common names, you might need to adjust if names differ
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own and shared budget transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert into own or shared budgets" ON transactions;
DROP POLICY IF EXISTS "Users can update transactions in own or shared budgets" ON transactions;
DROP POLICY IF EXISTS "Users can delete transactions in own or shared budgets" ON transactions;


-- 3. Create new comprehensive policies

-- SELECT: Users can see transactions if:
-- a) They created the transaction (user_id = auth.uid())
-- b) They own the budget (budget_id belongs to user)
-- c) The budget is shared with them and accepted
CREATE POLICY "Users can view own and shared budget transactions" 
ON transactions FOR SELECT 
USING (
  user_id = auth.uid() 
  OR 
  budget_id IN (
    SELECT id FROM budgets WHERE user_id = auth.uid()
  )
  OR 
  budget_id IN (
    SELECT budget_id 
    FROM budget_shares 
    WHERE shared_with_id = auth.uid() AND status = 'accepted'
  )
);

-- INSERT: Users can insert transactions if:
-- a) They are inserting into their own budget
-- b) They are inserting into a budget shared with them with 'edit' permission
CREATE POLICY "Users can insert into own or shared budgets"
ON transactions FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND (
     budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid())
     OR
     budget_id IN (
        SELECT budget_id 
        FROM budget_shares 
        WHERE shared_with_id = auth.uid() AND status = 'accepted' AND permission = 'edit'
     )
  )
);

-- UPDATE: Users can update transactions if:
-- a) They own the budget
-- b) They have edit permission on the shared budget
CREATE POLICY "Users can update transactions in own or shared budgets"
ON transactions FOR UPDATE
USING (
  budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid())
  OR
  budget_id IN (
     SELECT budget_id 
     FROM budget_shares 
     WHERE shared_with_id = auth.uid() AND status = 'accepted' AND permission = 'edit'
  )
);

-- DELETE: Users can delete transactions if:
-- a) They own the budget
-- b) They have edit permission on the shared budget
CREATE POLICY "Users can delete transactions in own or shared budgets"
ON transactions FOR DELETE
USING (
  budget_id IN (SELECT id FROM budgets WHERE user_id = auth.uid())
  OR
  budget_id IN (
     SELECT budget_id 
     FROM budget_shares 
     WHERE shared_with_id = auth.uid() AND status = 'accepted' AND permission = 'edit'
  )
);
