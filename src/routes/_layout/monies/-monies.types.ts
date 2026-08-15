export interface MoniesUser {
  id: string;
  name: string;
}

export interface MoniesExpense {
  id: string;
  item: string;
  amount: string;
  owedAmount: string | null;
  payer: MoniesUser;
  debtor: MoniesUser | null;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MoniesExpensePage {
  items: MoniesExpense[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ListMoniesExpensesInput {
  page?: number;
  pageSize?: number;
}

export interface CreateMoniesExpenseInput {
  item: string;
  amount: string;
  owedAmount: string;
  payerId: string;
  purchaseDate: string;
  idempotencyKey: string;
}

export interface UpdateMoniesExpenseFields {
  item?: string;
  amount?: string;
  owedAmount?: string;
  payerId?: string;
  purchaseDate?: string;
}

export interface UpdateMoniesExpenseInput extends UpdateMoniesExpenseFields {
  id: string;
}

export interface MoniesExpenseIdInput {
  id: string;
}
