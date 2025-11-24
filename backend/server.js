const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory database
let users = {
  'user1': {
    id: 'user1',
    email: 'demo@myfinance.com',
    balance: 10000,
    operations: [
      {
        id: 'op1',
        type: 'income',
        amount: 10000,
        category: 'salary',
        description: 'Зарплата',
        date: '2025-10-01'
      }
    ],
    budgets: [
      {
        id: 'budget1',
        category: 'food',
        limit: 15000,
        period: '2025-10',
        spent: 0
      }
    ]
  }
};

// Categories
const categories = {
  income: ['salary', 'freelance', 'investment', 'other'],
  expense: ['food', 'transport', 'entertainment', 'health', 'education', 'other']
};

// API Routes

// Get user data
app.get('/api/user/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// Add operation
app.post('/api/user/:userId/operations', (req, res) => {
  const user = users[req.params.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { type, amount, category, description, date } = req.body;
  
  // Validation
  if (!type || !amount || !category || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!categories[type].includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // Check balance for expenses
  if (type === 'expense' && amount > user.balance) {
    return res.status(400).json({ error: 'Insufficient funds' });
  }

  // Create operation
  const operation = {
    id: uuidv4(),
    type,
    amount: Number(amount),
    category,
    description: description || '',
    date
  };

  // Update balance
  if (type === 'income') {
    user.balance += operation.amount;
  } else {
    user.balance -= operation.amount;
  }

  // Update budget if expense
  if (type === 'expense') {
    const budget = user.budgets.find(b => b.category === category);
    if (budget) {
      budget.spent += operation.amount;
    }
  }

  user.operations.push(operation);
  user.operations.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json({
    operation,
    newBalance: user.balance
  });
});

// Get reports
app.get('/api/user/:userId/reports', (req, res) => {
  const user = users[req.params.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { startDate, endDate } = req.query;
  
  let operations = user.operations;
  if (startDate && endDate) {
    operations = operations.filter(op => 
      op.date >= startDate && op.date <= endDate
    );
  }

  const report = {
    totalIncome: operations.filter(op => op.type === 'income')
      .reduce((sum, op) => sum + op.amount, 0),
    totalExpense: operations.filter(op => op.type === 'expense')
      .reduce((sum, op) => sum + op.amount, 0),
    byCategory: {
      income: categories.income.map(cat => ({
        category: cat,
        amount: operations.filter(op => op.type === 'income' && op.category === cat)
          .reduce((sum, op) => sum + op.amount, 0)
      })),
      expense: categories.expense.map(cat => ({
        category: cat,
        amount: operations.filter(op => op.type === 'expense' && op.category === cat)
          .reduce((sum, op) => sum + op.amount, 0)
      }))
    }
  };

  res.json(report);
});

// Budget management
app.post('/api/user/:userId/budgets', (req, res) => {
  const user = users[req.params.userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { category, limit, period } = req.body;

  if (!category || !limit || !period) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const budget = {
    id: uuidv4(),
    category,
    limit: Number(limit),
    period,
    spent: 0
  };

  user.budgets.push(budget);
  res.json(budget);
});

app.listen(PORT, () => {
  console.log(`MyFinance backend running on http://localhost:${PORT}`);
  console.log('Demo user ID: user1');
});