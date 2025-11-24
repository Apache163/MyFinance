const API_BASE = 'http://localhost:3000/api';

// Global state
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Categories data
const categories = {
    income: [
        { value: 'salary', label: 'Зарплата' },
        { value: 'freelance', label: 'Фриланс' },
        { value: 'investment', label: 'Инвестиции' },
        { value: 'other', label: 'Другое' }
    ],
    expense: [
        { value: 'food', label: 'Еда' },
        { value: 'transport', label: 'Транспорт' },
        { value: 'entertainment', label: 'Развлечения' },
        { value: 'health', label: 'Здоровье' },
        { value: 'education', label: 'Образование' },
        { value: 'other', label: 'Другое' }
    ]
};

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    initCategories();
    setDefaultDates();
    
    // Form handlers
    document.getElementById('operationForm').addEventListener('submit', addOperation);
    document.getElementById('budgetForm').addEventListener('submit', addBudget);
    document.getElementById('operationType').addEventListener('change', updateCategories);
    document.getElementById('logoutBtn').addEventListener('click', logout);
});

// Auth functions
async function checkAuth() {
    if (!authToken) {
        window.location.href = 'login.html';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                'Authorization': authToken
            }
        });
        
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('userEmail').textContent = currentUser.email;
            loadUserData();
        } else {
            logout();
        }
    } catch (error) {
        logout();
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': authToken
            }
        });
    } catch (error) {
        // Ignore errors
    }
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('userEmail');
    window.location.href = 'login.html';
}

// Rest of the functions remain the same as before
function initCategories() {
    updateCategories();
    
    const budgetCategorySelect = document.getElementById('budgetCategory');
    budgetCategorySelect.innerHTML = categories.expense.map(cat => 
        `<option value="${cat.value}">${cat.label}</option>`
    ).join('');
}

function updateCategories() {
    const type = document.getElementById('operationType').value;
    const categorySelect = document.getElementById('category');
    const categoryList = categories[type];
    
    categorySelect.innerHTML = categoryList.map(cat => 
        `<option value="${cat.value}">${cat.label}</option>`
    ).join('');
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    
    const firstDay = new Date();
    firstDay.setDate(1);
    document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
    document.getElementById('endDate').value = today;
}

async function loadUserData() {
    try {
        const response = await fetch(`${API_BASE}/user`, {
            headers: {
                'Authorization': authToken
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            updateBalance(userData.balance);
            displayOperations(userData.operations);
            displayBudgets(userData.budgets);
        } else {
            logout();
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function updateBalance(balance) {
    document.getElementById('balance').textContent = `${balance.toLocaleString()} ₽`;
}

function displayOperations(operations) {
    const operationsList = document.getElementById('operationsList');
    
    if (operations.length === 0) {
        operationsList.innerHTML = '<div class="operation">Нет операций</div>';
        return;
    }
    
    operationsList.innerHTML = operations.map(op => `
        <div class="operation ${op.type}">
            <div>
                <strong>${op.type === 'income' ? '+' : '-'}${op.amount} ₽</strong><br>
                <small>${getCategoryLabel(op.type, op.category)}</small><br>
                <small>${op.description}</small>
            </div>
            <div>
                <small>${op.date}</small>
            </div>
        </div>
    `).join('');
}

function displayBudgets(budgets) {
    const budgetsList = document.getElementById('budgetsList');
    
    if (budgets.length === 0) {
        budgetsList.innerHTML = '<div>Бюджеты не настроены</div>';
        return;
    }
    
    budgetsList.innerHTML = budgets.map(budget => {
        const percentage = (budget.spent / budget.limit) * 100;
        const categoryLabel = getCategoryLabel('expense', budget.category);
        
        return `
            <div class="operation">
                <div>
                    <strong>${categoryLabel}</strong><br>
                    <small>Лимит: ${budget.limit} ₽</small><br>
                    <small>Потрачено: ${budget.spent} ₽</small>
                </div>
                <div>
                    <small>${percentage.toFixed(1)}%</small><br>
                    <small>${budget.period}</small>
                </div>
            </div>
        `;
    }).join('');
}

function getCategoryLabel(type, value) {
    const categoryList = categories[type];
    const category = categoryList.find(cat => cat.value === value);
    return category ? category.label : value;
}

async function addOperation(event) {
    event.preventDefault();
    
    const formData = {
        type: document.getElementById('operationType').value,
        amount: document.getElementById('amount').value,
        category: document.getElementById('category').value,
        description: document.getElementById('description').value,
        date: document.getElementById('date').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/operations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('operationForm').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            updateCategories();
            loadUserData();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        alert('Ошибка при добавлении операции');
    }
}

async function addBudget(event) {
    event.preventDefault();
    
    const formData = {
        category: document.getElementById('budgetCategory').value,
        limit: document.getElementById('budgetLimit').value,
        period: document.getElementById('budgetPeriod').value
    };
    
    try {
        const response = await fetch(`${API_BASE}/budgets`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('budgetForm').reset();
            loadUserData();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        alert('Ошибка при создании бюджета');
    }
}

async function generateReport() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Укажите период для отчета');
        return;
    }
    
    try {
        const response = await fetch(
            `${API_BASE}/reports?startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': authToken
                }
            }
        );
        
        if (response.ok) {
            const report = await response.json();
            displayReport(report);
        }
    } catch (error) {
        alert('Ошибка генерации отчета');
    }
}

function displayReport(report) {
    const reportResult = document.getElementById('reportResult');
    
    const html = `
        <div style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
            <h3>Итоги периода</h3>
            <p><strong>Общий доход:</strong> ${report.totalIncome} ₽</p>
            <p><strong>Общий расход:</strong> ${report.totalExpense} ₽</p>
            <p><strong>Баланс:</strong> ${report.totalIncome - report.totalExpense} ₽</p>
            
            <h4>Доходы по категориям:</h4>
            ${report.byCategory.income.map(cat => 
                `<p>${getCategoryLabel('income', cat.category)}: ${cat.amount} ₽</p>`
            ).join('')}
            
            <h4>Расходы по категориям:</h4>
            ${report.byCategory.expense.map(cat => 
                `<p>${getCategoryLabel('expense', cat.category)}: ${cat.amount} ₽</p>`
            ).join('')}
        </div>
    `;
    
    reportResult.innerHTML = html;
}

// Tab switching function
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}