-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.budget_shares (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  budget_id bigint NOT NULL,
  owner_id uuid NOT NULL,
  shared_with_id uuid NOT NULL,
  permission text NOT NULL DEFAULT 'view'::text CHECK (permission = ANY (ARRAY['view'::text, 'edit'::text])),
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT budget_shares_pkey PRIMARY KEY (id),
  CONSTRAINT budget_shares_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id),
  CONSTRAINT budget_shares_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id),
  CONSTRAINT budget_shares_shared_with_id_fkey FOREIGN KEY (shared_with_id) REFERENCES auth.users(id)
);
CREATE TABLE public.budgets (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid DEFAULT gen_random_uuid(),
  name text,
  order_position bigint,
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.categories (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid,
  name text,
  type text,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.embedding_queue (
  id integer NOT NULL DEFAULT nextval('embedding_queue_id_seq'::regclass),
  transaction_id bigint NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  CONSTRAINT embedding_queue_pkey PRIMARY KEY (id)
);
CREATE TABLE public.pending_telegram_actions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  chat_id bigint NOT NULL UNIQUE,
  action_type text,
  payload jsonb,
  CONSTRAINT pending_telegram_actions_pkey PRIMARY KEY (id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.telegram_links (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid DEFAULT auth.uid(),
  chat_id bigint UNIQUE,
  default_budget_id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  CONSTRAINT telegram_links_pkey PRIMARY KEY (id),
  CONSTRAINT telegram_links_default_budget_id_fkey FOREIGN KEY (default_budget_id) REFERENCES public.budgets(id),
  CONSTRAINT telegram_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.transactions (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  user_id uuid NOT NULL,
  amount double precision NOT NULL,
  type text,
  created_at timestamp without time zone DEFAULT now(),
  category text,
  month text,
  year text,
  description text,
  is_completed boolean,
  completed_at timestamp with time zone,
  due_day smallint,
  budget_id bigint,
  linked_income_id text,
  embedding USER-DEFINED,
  date date,
  status text DEFAULT 'pending'::text,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.trigger_logs (
  id integer NOT NULL DEFAULT nextval('trigger_logs_id_seq'::regclass),
  message text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trigger_logs_pkey PRIMARY KEY (id)
);