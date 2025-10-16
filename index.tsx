import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- Type Definitions ---
type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string; // ISO 8601 format
  category: string;
};

type View = {
  page: 'main' | 'income' | 'expense' | 'settings' | 'detail' | 'history' | 'tax';
  period?: 'daily' | 'weekly' | 'monthly';
  transactionType?: 'income' | 'expense';
};

type Theme = 'light' | 'dark' | 'auto';

type Currency = 'GBP' | 'USD' | 'CAD' | 'AUD' | 'EUR' | 'JPY' | 'CNY' | 'CHF' | 'INR';

// --- Constants & Utilities ---
const currencyMap: Record<Currency, string> = {
  'GBP': '£',
  'USD': '$',
  'CAD': 'CA$',
  'AUD': 'A$',
  'EUR': '€',
  'JPY': '¥',
  'CNY': '¥',
  'CHF': 'Fr',
  'INR': '₹',
};

const dateUtils = {
  isToday: (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  },
  isThisWeek: (date: Date) => {
    const today = new Date();
    const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
    firstDayOfWeek.setHours(0, 0, 0, 0);
    const lastDayOfWeek = new Date(firstDayOfWeek);
    lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
    lastDayOfWeek.setHours(23, 59, 59, 999);
    return date >= firstDayOfWeek && date <= lastDayOfWeek;
  },
  isThisMonth: (date: Date) => {
    const today = new Date();
    return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  },
  getWeekOfMonth: (date: Date) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const offsetDate = date.getDate() + firstDayOfMonth - 1;
    return Math.floor(offsetDate / 7) + 1;
  }
};


// --- Calendar Modal Component ---
const CalendarModal = ({ isOpen, onClose, onSelectDate }: {
    isOpen: boolean;
    onClose: () => void;
    onSelectDate: (date: Date) => void;
}) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    if (!isOpen) return null;

    const changeMonth = (offset: number) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    };

    const renderCalendar = () => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDate = new Date(year, month, i);
            days.push(
                <button key={i} className="calendar-day" onClick={() => { onSelectDate(dayDate); onClose(); }}>
                    {i}
                </button>
            );
        }
        return days;
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content calendar-modal" onClick={(e) => e.stopPropagation()}>
                <div className="calendar-header">
                    <button onClick={() => changeMonth(-1)}>&lt;</button>
                    <span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => changeMonth(1)}>&gt;</button>
                </div>
                <div className="calendar-grid">
                    <div className="calendar-day-name">Su</div>
                    <div className="calendar-day-name">Mo</div>
                    <div className="calendar-day-name">Tu</div>
                    <div className="calendar-day-name">We</div>
                    <div className="calendar-day-name">Th</div>
                    <div className="calendar-day-name">Fr</div>
                    <div className="calendar-day-name">Sa</div>
                    {renderCalendar()}
                </div>
            </div>
        </div>
    );
};


// --- Numpad Modal Component ---
const NumpadModal = ({ isOpen, onClose, onSubmit, title, currencySymbol, categories }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, category: string) => void;
    title: string;
    currencySymbol: string;
    categories?: string[];
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(categories && categories.length > 0 ? categories[0] : 'other');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (categories && categories.length > 0) {
        setSelectedCategory(categories[0]);
      }
      setInputValue('');
      setIsCategoryOpen(false);
    }
  }, [isOpen, categories]);

  const handleButtonClick = (value: string) => {
    if (value === '.' && inputValue.includes('.')) return;
    setInputValue(inputValue + value);
  };

  const handleClear = () => { setInputValue(''); };
  const handleEnter = () => {
    const amount = parseFloat(inputValue);
    if (!isNaN(amount) && amount > 0) {
      onSubmit(amount, selectedCategory);
      setInputValue('');
    }
  };

  if (!isOpen) return null;
  const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
           <h3>{title || 'Add Entry'}</h3>
           <button onClick={onClose} className="close-button" aria-label="Close modal">&times;</button>
        </div>
        
        {categories && categories.length > 0 && (
            <div className="category-selector">
                <button 
                    className="category-display-button" 
                    onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                    aria-haspopup="true"
                    aria-expanded={isCategoryOpen}
                >
                    <span>{selectedCategory}</span>
                    <span className={`arrow ${isCategoryOpen ? 'up' : 'down'}`}></span>
                </button>
                {isCategoryOpen && (
                    <div className="category-dropdown">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                className="category-dropdown-item"
                                onClick={() => {
                                    setSelectedCategory(cat);
                                    setIsCategoryOpen(false);
                                }}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        )}

        <div className="numpad-display" aria-live="polite">{currencySymbol}{inputValue || '0.00'}</div>
        <div className="numpad-grid">
          {numpadKeys.map(key => <button key={key} onClick={() => handleButtonClick(key)} className="numpad-button">{key}</button>)}
          <button onClick={handleClear} className="numpad-button action">Clear</button>
        </div>
        <button onClick={handleEnter} className="numpad-enter-button">Enter</button>
      </div>
    </div>
  );
};

// --- Detail Page Components ---
const DetailHeader = ({ title, onBack }: { title: string; onBack: () => void; }) => (
  <div className="detail-header">
    <button onClick={onBack} className="back-button">&larr; Back</button>
    <h2>{title}</h2>
  </div>
);

const TransactionListItem: React.FC<{ transaction: Transaction; currencySymbol: string; }> = ({ transaction, currencySymbol }) => (
  <li className="transaction-item">
    <div className="transaction-details">
        <span className="transaction-date">{new Date(transaction.date).toLocaleString()}</span>
        <span className="transaction-category">{transaction.category}</span>
    </div>
    <span className={`amount ${transaction.type}`}>{currencySymbol}{transaction.amount.toFixed(2)}</span>
  </li>
);

const DailyDetailPage = ({ transactions, type, onBack, currencySymbol }: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  onBack: () => void;
  currencySymbol: string;
}) => {
  const title = `Today's ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  return (
    <div className="page-content">
      <DetailHeader title={title} onBack={onBack} />
      <ul className="transaction-list">
        {transactions.length > 0 ? (
          transactions.map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)
        ) : <p>No transactions for today.</p>}
      </ul>
    </div>
  );
};

const WeeklyDetailPage = ({ transactions, type, onBack, currencySymbol }: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  onBack: () => void;
  currencySymbol: string;
}) => {
  const title = `This Week's ${type.charAt(0).toUpperCase() + type.slice(1)}`;
  const groupedByDay = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => {
    const day = new Date(tx.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(tx);
    return acc;
  }, {});

  return (
    <div className="page-content">
      <DetailHeader title={title} onBack={onBack} />
      {Object.keys(groupedByDay).length > 0 ? (
        Object.entries(groupedByDay).map(([day, txs]) => (
          <div key={day}>
            <h3 className="list-group-header">{day}</h3>
            <ul className="transaction-list">
              {(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)}
            </ul>
          </div>
        ))
      ) : <p>No transactions for this week.</p>}
    </div>
  );
};

const MonthlyDetailPage = ({ transactions, type, onBack, onViewHistory, currencySymbol }: {
    transactions: Transaction[];
    type: 'income' | 'expense';
    onBack: () => void;
    onViewHistory: () => void;
    currencySymbol: string;
}) => {
    const title = `This Month's ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    const groupedByWeek = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => {
        const week = `Week ${dateUtils.getWeekOfMonth(new Date(tx.date))}`;
        if (!acc[week]) acc[week] = [];
        acc[week].push(tx);
        return acc;
    }, {});

    return (
        <div className="page-content">
            <DetailHeader title={title} onBack={onBack} />
            <button className="action-button" onClick={onViewHistory}>View History</button>
            {Object.keys(groupedByWeek).length > 0 ? (
                Object.entries(groupedByWeek).map(([week, txs]) => (
                    <div key={week}>
                        <h3 className="list-group-header">{week}</h3>
                        <ul className="transaction-list">
                            {(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)}
                        </ul>
                    </div>
                ))
            ) : <p>No transactions for this month.</p>}
        </div>
    );
};

const HistoryPage = ({ transactions, type, onBack, currencySymbol }: {
    transactions: Transaction[];
    type: 'income' | 'expense';
    onBack: () => void;
    currencySymbol: string;
}) => {
    const title = `Monthly ${type.charAt(0).toUpperCase() + type.slice(1)} History`;
    const monthlyTotals = useMemo(() => {
        const totals: { [key: string]: number } = {};
        const now = new Date();
        for (let i = 0; i < 24; i++) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            totals[monthKey] = 0;
        }
        transactions.forEach(tx => {
            const date = new Date(tx.date);
            const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' });
            if (totals[monthKey] !== undefined) totals[monthKey] += tx.amount;
        });
        return totals;
    }, [transactions]);

    return (
        <div className="page-content">
            <DetailHeader title={title} onBack={onBack} />
            <ul className="history-list">
                {Object.entries(monthlyTotals).map(([month, total]: [string, number]) => (
                     <li key={month} className="history-item">
                        <span>{month}</span>
                        <span className={`amount ${type}`}>{currencySymbol}{total.toFixed(2)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};


// --- Main Page Components ---
const MainPage = ({ income, expenses, onNavClick, currencySymbol }: {
  income: number;
  expenses: number;
  onNavClick: (page: 'income' | 'expense') => void;
  currencySymbol: string;
}) => {
  const balance = (income - expenses).toFixed(2);
  return (
    <div className="page-content">
      <h2>Dashboard</h2>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onNavClick('income')}>
          <div className="card-label"><h3>Income</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled expense clickable" onClick={() => onNavClick('expense')}>
          <div className="card-label"><h3>Expense</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled balance">
          <div className="card-label"><h3>Balance</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{balance}</p></div>
        </div>
      </div>
    </div>
  );
};

const IncomePage = ({ income, weeklyIncome, monthlyIncome, addIncome, onCardClick, currencySymbol }: {
  income: number;
  weeklyIncome: number;
  monthlyIncome: number;
  addIncome: (amount: number, category: string) => void;
  onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
  currencySymbol: string;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const incomeCategories = ['Cash', 'Card', 'Bank Transfer', 'Other'];
  const handleAddIncome = (amount: number, category: string) => { addIncome(amount, category); setIsModalOpen(false); };
  return (
    <div className="page-content">
      <h2>Income</h2>
      <button className="action-button" onClick={() => setIsModalOpen(true)}>Add Income</button>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onCardClick('daily')}>
          <div className="card-label"><h3>Daily</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('weekly')}>
          <div className="card-label"><h3>Weekly</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{weeklyIncome.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('monthly')}>
          <div className="card-label"><h3>Monthly</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{monthlyIncome.toFixed(2)}</p></div>
        </div>
      </div>
      <NumpadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddIncome} 
        title="Add Income" 
        currencySymbol={currencySymbol}
        categories={incomeCategories}
      />
    </div>
  );
};

const ExpensePage = ({ expenses, weeklyExpenses, monthlyExpenses, addExpense, onCardClick, currencySymbol }: {
    expenses: number;
    weeklyExpenses: number;
    monthlyExpenses: number;
    addExpense: (amount: number, category: string) => void;
    onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
    currencySymbol: string;
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const expenseCategories = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];
    const handleAddExpense = (amount: number, category: string) => { addExpense(amount, category); setIsModalOpen(false); };
    return (
      <div className="page-content">
        <h2>Expense</h2>
        <button className="action-button expense" onClick={() => setIsModalOpen(true)}>Add Expense</button>
         <div className="cards-list">
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('daily')}>
            <div className="card-label"><h3>Daily</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div>
          </div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('weekly')}>
            <div className="card-label"><h3>Weekly</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{weeklyExpenses.toFixed(2)}</p></div>
          </div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('monthly')}>
            <div className="card-label"><h3>Monthly</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{monthlyExpenses.toFixed(2)}</p></div>
          </div>
        </div>
        <NumpadModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAddExpense} 
            title="Add Expense" 
            currencySymbol={currencySymbol}
            categories={expenseCategories}
        />
      </div>
    );
};

const SettingsPage = ({ theme, onThemeChange, currency, onCurrencyChange }: {
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    currency: Currency;
    onCurrencyChange: (currency: Currency) => void;
}) => (
  <div className="page-content">
    <h2>Settings</h2>
    <div className="settings-group">
      <h3>Appearance</h3>
      <div className="theme-selector">
        <button onClick={() => onThemeChange('light')} className={theme === 'light' ? 'active' : ''}>Light</button>
        <button onClick={() => onThemeChange('dark')} className={theme === 'dark' ? 'active' : ''}>Dark</button>
        <button onClick={() => onThemeChange('auto')} className={theme === 'auto' ? 'active' : ''}>Auto</button>
      </div>
    </div>
    <div className="settings-group">
      <h3>Currency</h3>
      <select className="currency-selector" value={currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)}>
        {Object.entries(currencyMap).map(([code, symbol]) => (
          <option key={code} value={code}>{code} ({symbol})</option>
        ))}
      </select>
    </div>
  </div>
);

const TaxPage = ({ transactions, currencySymbol }: {
    transactions: Transaction[];
    currencySymbol: string;
}) => {
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const [isCalendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null);
    const [reportReady, setReportReady] = useState(false);

    const reportData = useMemo(() => {
        if (!startDate || !endDate || endDate < startDate) return null;
        
        const start = new Date(startDate.setHours(0, 0, 0, 0));
        const end = new Date(endDate.setHours(23, 59, 59, 999));
        
        const filtered = transactions.filter(tx => {
            const txDate = new Date(tx.date);
            return txDate >= start && txDate <= end;
        });

        const totals = filtered.reduce((acc, tx) => {
            if (tx.type === 'income') acc.income += tx.amount;
            else acc.expense += tx.amount;
            return acc;
        }, { income: 0, expense: 0 });

        return {
            transactions: filtered,
            totalIncome: totals.income,
            totalExpense: totals.expense,
            balance: totals.income - totals.expense,
        };
    }, [transactions, startDate, endDate]);

    const generateCSV = () => {
        if (!reportData) return;
        setReportReady(false); // Reset for next time

        let csvContent = "Date,Type,Amount,Category\n";
        reportData.transactions.forEach(tx => {
            csvContent += `${new Date(tx.date).toLocaleString()},${tx.type},${tx.amount.toFixed(2)},${tx.category}\n`;
        });
        csvContent += "\n";
        csvContent += `Total Income,${reportData.totalIncome.toFixed(2)}\n`;
        csvContent += `Total Expense,${reportData.totalExpense.toFixed(2)}\n`;
        csvContent += `Balance,${reportData.balance.toFixed(2)}\n`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateString = `${startDate!.toISOString().split('T')[0]}_to_${endDate!.toISOString().split('T')[0]}`;
        link.setAttribute("download", `tax-report-${dateString}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setReportReady(true); // Indicate that download is done and email can be sent
    };
    
    const sendEmail = () => {
        const subject = "Tax Report";
        const body = `Hello,\n\nPlease find my tax report attached for the period from ${startDate!.toLocaleDateString()} to ${endDate!.toLocaleDateString()}.\n\nThank you.`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    return (
        <div className="page-content">
            <h2>Tax Report</h2>
            <p className="page-subtitle">Select a period to generate your report.</p>

            <div className="date-selector-container">
                <div className="date-selector" onClick={() => setCalendarOpen('start')}>
                    <label>Start Date</label>
                    <span>{startDate ? startDate.toLocaleDateString() : 'Select a date'}</span>
                </div>
                <div className="date-selector" onClick={() => setCalendarOpen('end')}>
                    <label>End Date</label>
                    <span>{endDate ? endDate.toLocaleDateString() : 'Select a date'}</span>
                </div>
            </div>

            {reportData && (
                <div className="report-summary">
                    <h3>Report Summary</h3>
                    <div className="summary-item"><span>Total Income:</span><span className="amount income">{currencySymbol}{reportData.totalIncome.toFixed(2)}</span></div>
                    <div className="summary-item"><span>Total Expense:</span><span className="amount expense">{currencySymbol}{reportData.totalExpense.toFixed(2)}</span></div>
                    <div className="summary-item"><span>Balance:</span><span className="amount balance">{currencySymbol}{reportData.balance.toFixed(2)}</span></div>
                    {!reportReady ?
                       <button className="action-button" onClick={generateCSV}>Download Report (.csv)</button> :
                       <button className="action-button income" onClick={sendEmail}>Send Email</button>
                    }
                </div>
            )}

            <CalendarModal 
                isOpen={!!isCalendarOpen} 
                onClose={() => setCalendarOpen(null)}
                onSelectDate={date => {
                    if (isCalendarOpen === 'start') setStartDate(date);
                    if (isCalendarOpen === 'end') setEndDate(date);
                }}
            />
        </div>
    );
};


// --- Icon Components ---
const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const IncomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M13 19V7.83l4.59 4.58L19 11l-7-7-7 7 1.41 1.41L11 7.83V19h2z"/></svg>;
const ExpenseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M11 5v11.17l-4.59-4.58L5 13l7 7 7-7-1.41-1.41L13 16.17V5h-2z"/></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>;
const TaxIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2H9v-2H7v-2h2V9h2v2h2v2zm4-6V3.5L18.5 9H13z"/></svg>;

// --- Layout Components ---
const Header = () => (
  <header className="app-header">
    <h1>Welcome to Account Assistant</h1>
    <p className="slogan">Your Accountancy Assistant for MTD</p>
  </header>
);

const Footer = ({ currentPage, onNavClick }: {
  currentPage: string;
  onNavClick: (page: string) => void;
}) => {
  const navItems = [
    { page: 'main', label: 'Home', icon: <HomeIcon /> },
    { page: 'income', label: 'Income', icon: <IncomeIcon /> },
    { page: 'expense', label: 'Expense', icon: <ExpenseIcon /> },
    { page: 'tax', label: 'Tax', icon: <TaxIcon /> },
    { page: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  ];
  return (
    <footer className="app-footer">
      <nav>
        {navItems.map(item => (
          <button
            key={item.page}
            className={currentPage === item.page ? 'active' : ''}
            onClick={() => onNavClick(item.page)}
            aria-label={`Go to ${item.label} page`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </footer>
  );
};


// --- Main App Component ---
function App() {
  const [view, setView] = useState<View>({ page: 'main' });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'auto');
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('currency') as Currency) || 'GBP');

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => body.classList.toggle('dark-theme', mediaQuery.matches);
      handleChange(); // Initial check
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('currency', currency);
  }, [currency]);

  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);

  const addTransaction = useCallback((amount: number, type: 'income' | 'expense', category: string) => {
    const newTransaction: Transaction = {
      id: new Date().toISOString() + Math.random(),
      type, amount, date: new Date().toISOString(), category
    };
    setTransactions(prev => [...prev, newTransaction]);
  }, []);

  const { dailyIncome, weeklyIncome, monthlyIncome, dailyExpenses, weeklyExpenses, monthlyExpenses } = useMemo(() => {
    const totals = { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0 };
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      if (dateUtils.isToday(date)) {
        if (tx.type === 'income') totals.dailyIncome += tx.amount; else totals.dailyExpenses += tx.amount;
      }
      if (dateUtils.isThisWeek(date)) {
        if (tx.type === 'income') totals.weeklyIncome += tx.amount; else totals.weeklyExpenses += tx.amount;
      }
      if (dateUtils.isThisMonth(date)) {
        if (tx.type === 'income') totals.monthlyIncome += tx.amount; else totals.monthlyExpenses += tx.amount;
      }
    });
    return totals;
  }, [transactions]);

  const handleNavClick = (page: 'main' | 'income' | 'expense' | 'settings' | 'tax') => setView({ page });
  const handleCardClick = (type: 'income' | 'expense', period: 'daily' | 'weekly' | 'monthly') => setView({ page: 'detail', transactionType: type, period });

  const renderPage = () => {
    const { page, period, transactionType } = view;

    if (page === 'history') {
      const allTypeTransactions = transactions.filter(tx => tx.type === transactionType);
      return <HistoryPage transactions={allTypeTransactions} type={transactionType!} onBack={() => handleCardClick(transactionType!, 'monthly')} currencySymbol={currencySymbol} />;
    }
    
    if (page === 'detail') {
      const filters = { daily: dateUtils.isToday, weekly: dateUtils.isThisWeek, monthly: dateUtils.isThisMonth, };
      const relevantTransactions = transactions.filter(tx => tx.type === transactionType && filters[period!](new Date(tx.date)));
      const onBack = () => setView({ page: transactionType });
      const onViewHistory = () => setView({ page: 'history', transactionType });

      switch (period) {
        case 'daily': return <DailyDetailPage transactions={relevantTransactions} type={transactionType!} onBack={onBack} currencySymbol={currencySymbol} />;
        case 'weekly': return <WeeklyDetailPage transactions={relevantTransactions} type={transactionType!} onBack={onBack} currencySymbol={currencySymbol} />;
        case 'monthly': return <MonthlyDetailPage transactions={relevantTransactions} type={transactionType!} onBack={onBack} onViewHistory={onViewHistory} currencySymbol={currencySymbol} />;
        default: setView({ page: 'main' }); return null;
      }
    }
    
    switch (page) {
      case 'income':
        return <IncomePage 
                 income={dailyIncome} weeklyIncome={weeklyIncome} monthlyIncome={monthlyIncome}
                 addIncome={(amount, category) => addTransaction(amount, 'income', category)}
                 onCardClick={(period) => handleCardClick('income', period)}
                 currencySymbol={currencySymbol}
               />;
      case 'expense':
        return <ExpensePage 
                 expenses={dailyExpenses} weeklyExpenses={weeklyExpenses} monthlyExpenses={monthlyExpenses}
                 addExpense={(amount, category) => addTransaction(amount, 'expense', category)}
                 onCardClick={(period) => handleCardClick('expense', period)}
                 currencySymbol={currencySymbol}
               />;
      case 'settings':
        return <SettingsPage theme={theme} onThemeChange={setTheme} currency={currency} onCurrencyChange={setCurrency} />;
      case 'tax':
        return <TaxPage transactions={transactions} currencySymbol={currencySymbol} />;
      case 'main':
      default:
        return <MainPage income={dailyIncome} expenses={dailyExpenses} onNavClick={(p) => handleNavClick(p as 'income' | 'expense')} currencySymbol={currencySymbol} />;
    }
  };

  return (
    <div className="app-container">
      <Header />
      <main>{renderPage()}</main>
      <Footer currentPage={view.page} onNavClick={handleNavClick as (page: string) => void} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);