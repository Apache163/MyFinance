const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory database with users
let users = {
  'user1': {
    id: 'user1',
    email: 'demo@myfinance.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
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

let sessions = {}; // Store active sessions

// Categories
const categories = {
  income: ['salary', 'freelance', 'investment', 'other'],
  expense: ['food', 'transport', 'entertainment', 'health', 'education', 'other']
};

// Middleware для проверки авторизации
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userId = sessions[token].userId;
  next();
};

// Auth Routes

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Check if user already exists
  const existingUser = Object.values(users).find(user => user.email === email);
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    
    users[userId] = {
      id: userId,
      email,
      password: hashedPassword,
      balance: 0,
      operations: [],
      budgets: []
    };
    
    // Create session
    const sessionToken = uuidv4();
    sessions[sessionToken] = {
      userId,
      createdAt: new Date()
    };
    
    res.json({
      token: sessionToken,
      user: {
        id: userId,
        email: email,
        balance: 0
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  
  // Find user by email
  const user = Object.values(users).find(user => user.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  try {
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionToken = uuidv4();
    sessions[sessionToken] = {
      userId: user.id,
      createdAt: new Date()
    };
    
    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        balance: user.balance
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const token = req.headers['authorization'];
  delete sessions[token];
  res.json({ message: 'Logged out successfully' });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = users[req.userId];
  res.json({
    id: user.id,
    email: user.email,
    balance: user.balance
  });
});

// Protected API Routes

// Get user data
app.get('/api/user', authenticateToken, (req, res) => {
  const user = users[req.userId];
  res.json(user);
});

// Add operation
app.post('/api/operations', authenticateToken, (req, res) => {
  const user = users[req.userId];
  
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
app.get('/api/reports', authenticateToken, (req, res) => {
  const user = users[req.userId];

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
app.post('/api/budgets', authenticateToken, (req, res) => {
  const user = users[req.userId];

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
  console.log(`MyFinance backend with auth running on http://localhost:${PORT}`);
  console.log('Demo credentials: email: demo@myfinance.com, password: password');
});