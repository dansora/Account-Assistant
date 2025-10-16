import React, { useState, useCallback, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- Type Definitions ---
type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  date: string; // ISO 8601 format
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
const NumpadModal = ({ isOpen, onClose, onSubmit, title, currencySymbol }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number) => void;
    title: string;
    currencySymbol: string;
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleButtonClick = (value: string) => {
    if (value === '.' && inputValue.includes('.')) return;
    setInputValue(inputValue + value);
  };

  const handleClear = () => { setInputValue(''); };
  const handleEnter = () => {
    const amount = parseFloat(inputValue);
    if (!isNaN(amount) && amount > 0) {
      onSubmit(amount);
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
    <span>{new Date(transaction.date).toLocaleString()}</span>
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
  addIncome: (amount: number) => void;
  onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
  currencySymbol: string;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const handleAddIncome = (amount: number) => { addIncome(amount); setIsModalOpen(false); };
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
      <NumpadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddIncome} title="Add Income" currencySymbol={currencySymbol}/>
    </div>
  );
};

const ExpensePage = ({ expenses, weeklyExpenses, monthlyExpenses, addExpense, onCardClick, currencySymbol }: {
    expenses: number;
    weeklyExpenses: number;
    monthlyExpenses: number;
    addExpense: (amount: number) => void;
    onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
    currencySymbol: string;
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const handleAddExpense = (amount: number) => { addExpense(amount); setIsModalOpen(false); };
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
        <NumpadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddExpense} title="Add Expense" currencySymbol={currencySymbol} />
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

        let csvContent = "Date,Type,Amount\n";
        reportData.transactions.forEach(tx => {
            csvContent += `${new Date(tx.date).toLocaleString()},${tx.type},${tx.amount.toFixed(2)}\n`;
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
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>;
const TaxIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2H9v-2H7v-2h2V9h2v2h2v2zm4-6V3.5L18.5 9H13z"/></svg>;

// --- Layout Components ---
const Header = () => (
  <header className="app-header">
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAYAAABccqhmAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAE/zSURBVHja7Z17lB1Vtcf/X/ftYV4QEAURB9zE8IeJYoxjND7rOqPjOqPjqI46Y8c0RzQxmhjRmIxa3FFx0VHEsYIgygMqIogKAvM8+957f/fcu+6qVlX1VvfeU3X1L7/cqlatVl1VrV/9b397P3wGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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4//P+//m/+/+H+//x/9v+//9f/L/+/0v9j/b/m/9f+//L/0/+v+//i//v+l/i/8H/L/x/+D/y/+z/o/+n/1/9H/qf5X/t/8f8v/S/x/+H+j/1P/3/j/+f+//S/+v8L/+/8v9j/S/+v+L/1/wv/r/a/1P9r/9/mv4n+L/m/+//4/0v/z/if+P+L/+/8X+//wf8P/S/+v+D/0v9r/V//v+z/rf+//p/qv/X/xP/X/w//r/j/4/+H+//S/+v8b//v8L/+/yv/r/+P+//U/+//4f+L/8/4n/4/+H//f+//F/5/7n+L/+P9v/w//P+F/+//p/8P9b/Q/9P8L/9/g/0P+T/a/+P+T/a/zP+//5/6f8H//f4f8//h/3P+D/u/3f/b/o/+/+p//P9T/s//n+//p/+/+//F/1//j/+f+//U//f/D/t//f/J/4f+/+D/S//P+//k/+P//f5/+n//f5v/3/o/5P/n/jf+P/V/3P8j/t/+P/V/3P/z/i/+f8H/s//v/l//v+t//f9n//f7v/3/i//f/P//P8T/1/wv/7/B/9f8b/1/zv//v6P/B/+v8r/o//H+//0v9z/S//P+p//P+//qf8n+//R//f/R//f/p//P/R/+f/h//f+p/3P9z/h//f9n/b/m/+/+//2/+v/b/7f/b//f/j/+/0/+v+x//f/p/+/0//H/8/+v/L//v+X//v+X//f5v//f0P+//0P8n/x//P/n//P/p//f/L//v/R//P/X//f8b//v8b//f+n//v9b//f+n//v+n//f8j//P+//mf+//mf8n/1/9T/t/+v/b/5v/b/5f/L//v+D/2//r/+f+p/+f+r/+f8D/2/+v/j/+//if//+L//f4P/+/8//R/m/+P//f8j/+/yP+//p//v+R//f+R/+f8r//P/B//v8D//v+T/6P/B/+v8z/9/5v//fzf/P/t/+f8z//v+p//v+J/+f8D/+/yv/x/qf//+h/7f/P//f/B/+v+x/z/+/7P+//V/+v/R/y//P/T/+/xP/3/S//P/b/y/+/7P+//S//v/B/+v+D/5/+r/4/+f+n/+/+x//v8r/o/9f+//p/9v+j/+f+//kf9f/1P+//U//P+j//P+D//P+D/wP8//R/y/+D/z/6P/b//P8j/y/+v/2/+n/3P8//T//P8//t/k/+P+//yf/X/k/+v+//kf+v+//8v/v/zP//f/B/+/8v//f+D//v+//o/+n//v+D//v+n/wf+/+H/kf+v/n//f+L/9/+R//f/P//f8z//f+R//P8T/+/wv/p/yf+//if9/+R//f6H//v/b/6/+n/B/+v8r/+/yv//+J//f+T/6/+r/9f9L/+/yP+//p/9f+n//P/p//f+h/9f4H/qf+/+x/6f+x/+f+z//v+B/5v/B/+P/V/3P/D//P8j//v8H/y/+D/5v/r/+f+r//f/B//v8n/9/4f/j/zP//fgv+//5f+//r/6f+v/qf//+n//v+p//v+v/j/+v/kf//+p//v+//g/+v/g/8n+T/k//v+T/3/8//d/+n/9/yv+P/d/+n//f+//yf+//2/y//x/6f//+j/j/+f/1/5v/L/+/0//v/N/+f+//m/+v//f+3//v9b/6/xP/r/A//v8j/y/+v/2/+v+//kf//+R//f/P//P/b/+v+z/9/0v//+T/+/yf//+R/+v+D//P+J/4/+j/z/+D/wf+T/o/6P/b//v8D//v+B//v8//L//P+//4f8j/y/+/8D/9/k//v/t/7/+n/o/+n/U//P/xP//+D/x/yP/x/wf+n/1f/n/9/+j//v+t//v/p/7f+3/9/+j/+v+v/9/+v/r/S//P/D/+v/D/+//R/9/+D/8f+f/z/+D/j/+n/1/4P/X/w//r/j/+f+//J/+/8v//P/L/+v9b/9/wv/L/K//v8L/6/+j/8f8v/9/+v/9/6v+//jf+v/B//P/r/+v/F/+v+L/6/+T/+/8X//v+R//P8L//v+R/9f/J//v8L/0f+z/6f/B/+v+L/z/+r/6f+//if/H/6/+//if+//i//X/C//v+D/o/7n/9/j/+f+x/9/+b/6/+/+D/wP/T/+//D/wf/P/B/8/+T/y/+f/S/+v8j/q/+f/2/+H/X/k/+v/r/+f+3//v+t//f8j/q//X+//8v+3/6f+//w/9f8j/9/+f/2/+v/o/9f8X//v+L//v+X/o/6f+//j/p/4P/D/t//X/D//P/xP+3/g/8v+//E/+/wf/X/C/+v8L/+//A/+v8D//v+T/9f8//R/+v8X//P+L//v8n//f63//v+T//v+t/+v+t/7v/T//f+//g/+f+//p/9f+P//f+//1/+n/s//X/H//P8T/6/yP/b/+v+j/+/8v//v+L/7/+D/w//L//v+r/+/6f+//p/6v+//k/+P//f8T/1/wv/r/C/9f8D/+/wv/p/if/n/B/+v+D/+/yP+//p/+/yv/x/wv/H/j/+f+j/o/+f+//5f6f/X/C/+v8b/+/wv/r/E/9f8L/+/8X/+/8//p/0f/p/z/+f/2/+v+z/r/x/+P+//z/+n/9//P//v8r/y/xv/3/xP/v+p//v9n/p/y//3/x//f/p/3f8j/y/xP/X/p//f/L/+/4n/o/9f+//p/+/+D/5f5n/p/xf/n+n/+/+z/6/9P//f/z//X/F//v+D//P8z//v+p//v+r/5f8X/6/6f/5/m/+f8L//v8r/0/+v+//6/+n//v+n//v+T//v+R/+v+p//v+v/i//X/G/+v/B//v8D//v+D/6/+r/1//v/qf6v+//p/6f+v/p//X/F/8v8X/+/8f/j/A//v+x/y/+P//f/T/6/wP/r/r/+/yP//f+3//v/b//P8b/9f/z/+//R/9f8j/9f+n//v8j/9f8L/5/wv//f4n/V//P//f4H//v+D/6/8H/5/+P/9/+f//P+j/+v+v/q/+X+//g/+n/V//P/x//P8T/+/xf//f8n//v+x/z/+/7P//f9L//f6H//P8z/o/+f/B/+v+D/9/+t/9f+j/6f8//X+//8X/x/5P//f8v//f+3//v/r//X+//7f+//t//v/p/+/0//v+n//v+L/9/+D/7/+v/1/+n/1/if/H/6/+v/i/+v+j//v+D//v8n//f8j/o/+f+//kf9f+//x/6v/1//v/B/+v8r/o/9f+//6/6//P/r//v/j/p/9P/1/wP//f7P/r/t/+v/p//X+n/7v/N//f+z//v9L//f+L//v9L/9/+L/9f6P//v9b//f+n//v+L//v+D//v8j//f8T/+/yP+//p//v+D//v8v//f8j//P/L/y/+/8L/+/8b//v/L/6/+j//v+D/+/wP/b/+P+//s//f+//k//v+D//f6H//v8v//f+j//v8H//f6H//v8n//f8H//f8H/w/+3/5f+//U//f/D/t//X/D//f/B/+/5P//P+//6v+v//v8H/y/+D/z/+H//v/B/+P/L//v+D/x/yf//f43//P+N//v8r/qf+//T//X/C/8f8v//f6n//v+t//v+t//P/p//f/p//f+t//f8D/+/wP/L/C/+v8T/9/+T//v+L//v8n//f9P//v/p/8P/p/5/+v//f+L//f8//d/+f//v+v/x/6v+//x/6/+P/x/8//X/r/+f+//x/9v/d/+f//f/L/y/+v/1f6P//v8n//v+L//v+L/7v/R//P8T/1/i/+v+L//f4P//f/j/+f/H//f/H//v+x/5f+T//f4P/q//X//f9P//f8D//v8D//v+T/y//L//v8D//v/B/+/5n/v/6v+//qf9f+//T//P/L/+v9b//f+//3f+L//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v8r/9/+j/+v+x/+f8L//v+L/6/+v/p/6f+//g/+f+D/6/+j/8f+L/9/+t//P/p//f+T//v8b/9f9P//v+T//f+v//f4H//v+v//v/p/+/+D/8f+P/5/+P//f+//1/+n//v+B//v8H/5/6P//v9L//v+L//v/D/+/5v/b/m/+v+t//v+B//P/D//v+x/4f8H/4/yf//f+//X/p/+/6f//v9b//f+T//v8v//f+//P//v8T/+/8f//f+v//f6f//P+j//P+T/9f+v//v+L/+/wP/L/C/+v8D//v+L//P/J//v8r//f8r//v+t//v9b//f8b/1/m/+v+L/+/xP+//k/+v/t/+f8z//v/L//f+D//v8//L/K//v8L/6/+T//v+P/5/+v//f/D/x//P/x//f/p//f8j//f/L//v+p/7f+z//v9L//v+j//v+b//f9r/7/w//3/qf7P+P/z/z//f/D/yf+//L/q/8P/t/+n/9/xv/X/p//f/L//v8v//f8j/9/+t//v+t//v+v//v9L//v8n//f+//z//X//P/T/o/8v//f+//P//v/B/+v+x/y/+j/+/+D/8f+L/+/+L/+/+L//v8//p/0v/z/xv//f7v//v8n/9/5f/j/A//v8j//f+D/o/8P+//E//f6v//f4n//v+//x/8f/p//v+v//f43/1//n/+//1//v+1//v+t//f/P/x/9f+3/9/+n//v+v//v+//P//v9r//f+T/9f6H//v8v//v+v//f+3//f/L/y/+f/5/+v+//D/w//L//f+B/+v/B/+P8v//f8b//f+L//f8X//P+j/8f+//x/+v+v/5v/L/6/+v/p/+/8D/+/8b/9/wv/L/K//v8v//f4P/v/o//H/L//v+x/8f+//if+v+//kf+v/kf+v8z//v8L/+/xv/r/M/+v+B//P+B//P+j/+/8v//P8r//f4v//f6v/r/S//P8T//v8D//v8j//f+j//v+v//P+j/+/8H/o/8v/x/i//X+T/8f+f/z/+v//v+n//v+L/6/+D//P+L//v+//3v+1//P+L/6/+n/+/wP/b/y//X/s//v/n//f+j/o//f//f/x//f/D//f+P/5/+v//f+//if+//1//v/t/7/+P//f6v/r/w/+v/C/+/wv/p/qf+//S//v+T//v+T//f+//v/+f//v+//k//X+//x/9v/D/yf9//t/+v/p//X/r//f6//v/S//v+j/6/+P/8f8v//f/x//f+v/5f5X//v8X//v+D/2//r/+f8D/6/xf//P+B//v8D//P/p/+/xP/H/A//v8D//v+L/6/+j/+/8P//v+L//v+L/4/+v/r/+/yv/r/j/+f+//q/+v+//6f8v//f6H//P8H//f6f//P/T//f+v//P+L//f/D/w/+v//v8H//f4H//v/b//P8j//P/L/+/0v//f+f/o/+/+//L//v8L/6/+L//P/L/6/+v/6/+v/6f/B/+/6f//v9b//f+T/6f+v//P8j//f+P//v8r/o/9f+//s/+/0v//v8T/+/yv//v+D/8/+P/8/+v//v+P/8/+P//f+//x/6/+P/2//L/y/+v/p/9f+//p/9f+//o/+f//v+v/4f8H/o/+n/1/if/H/9/7//H//P8v//f8H/x/i//H/r//f+x//v+//5f+//z/y//L/0f+z//v/t//X+j/+/+f/4/2/+f+//x//L/x//L/xf8H/4/xf/H/D//v+B//P8n//f8j/5f+T//f6H//v8v//f8H//v8n//f8n//f+r/+/6f//v+T//f+//7/+t/+/wP/L/K//v8D/+/wv/p/yf//f6v/p/6v+//jf+n/N/8/+T//f8j/+/yP//f8j/0f+n//v8n/9/4f/r/j//f+//yf+//B/+f+//J//P8L/6/+b//f9r//P/p//v+x//v8v//v+D//f4H//v+j/+/wv/p/y//f/r/+f+v/p//X/B/+/+L//v8r/y/+v/1/j//v/b/+v+L//f6H//v8L/y/wv/L/D/xf5P/p/5f9r/b/+n//v+t//f8j/9/+j/+f+3//v+t//f8v//f8v//f+//P//v9L//f8//d/+f//v+L//f/r//f+j//v8H//f8H//v+//P//v/b//P+v//f8L/9/qv+//if+v+//p//X+//s/+v+//i//X+//g/+f+D/2//r/B/+f8L//v8r//f+//v/0/+v+T/9f8D//v8j/y/+v//v/j//v+3/o//P//f+//k//v+D/y/+n//P+//y//r/+v+//p/6v+//o/+n//v+D//v8H/y/+D/z/+H//v/B/+P/L/+/1/+n//v+t/7/+j//P+T/9f+//kf9f+//x/q/+v+r/+/yP+//p//v+v//f4H/qf+/+x/6f+z//v+n/wf+/8D//f8D/+/wP/L/K//v8D/+/wv/p/if/P+L//v+D//v8L/9/+j/+//H/w/6//+/6f/p/+f+f/q/+v/9/6v+//S/zP+v+//if+//yf+//B//f+//if9/+T/+/8X/x/5P/b//P+p//v8v//P/L/+v9b/9f+v//f+n//v9b//f8j//v8D//v8j/+/yP/r/S//v+p//v8//L/K//v8L/+/8X//P+T/9f5n/5f7X+//g/+n/V//P/r//P/B//P8L//v8n//f8H//P+v/z/+//R/9/+D/8f+f/z/+D/o/6f+//w/9f8j/9/+f/2/+n//f+//5f+//g//L//v+x//f+v//f8X/x/wv/H/j/o/6/+v+//4/+v+//5f4X//v+L//f4P/y/8v/V//f+//t/+f+//o//H/L//v+r/+v+r/6f+//t/7f+//1//v/t/8/+j/+v+v//f+n//v+B//v+j//v+T/6f+v//f8H//v+v/6/+v/i/+v+t//v+D/+//s/y/+j/+/+D/8f+L//P8T/6/yP/b/y/9f+//k//X+//x/9f+//+/8//l/2v8//l/6f8H//v8P/j/+f/b/+v+z/9/4/+f+b/z//X/D//P8D/6/wv/b/B/+//U/+f+n/+/+P//P/x//f/p//f/L//v/D/x//P/x//f+j//v8L/+/wv/p/qf+//T/y/+j/6f8v//f+//9/+v+//r/+f+//x/6/+j//P/j//v+D//v+//L/t/+v+//qf+//T/+/wP/v/o//H/L/+/+b/o/8v+//E/+/wf/X/L/+v9L//P8v//v+L/6/+j/8f+v//P+j//P+L//P/L//v8n//f+//z/+v//v+t//f8L//f8//L/q//v/z//f/b/2/+v/6/+v/p/+/0//v+n//v+D//v+n/wf+/+H/kf+v/n//f+L//v8D//v+T/y//T/y/+/7P//P+//6/yf//P8T/9/kv6/+j/+/yf+//p//v+//5f+//o/+f//v+v/4/+n/1/9T/U/+P+T/tf+//n/qf6v//f/D/6v+//7f+n//v+D//v8v//f+v/5f5//v/+j/t/yf/H/S/+f+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+//if+//i//X+//g/+f+D/o/7n/6/xf//v/h/8P/B/8//L/hf9v/z/g/4P/D/s/5n/z/8//P/I/9/+D/+f/h//v+t//v+D//v8H//v+//P//P8b/9f9P//v8D//v8v//f+v/9/+n//f8D/+/wP/b/y//f+D//v8L/5/6P//P+j/+/yP/p/xf/H/g/+f+//q/+v/9/6v+//yf+v8L/6/+3//v+t//v/D//v8T/9/+T//v+t//v+D//f6H//v8D//v+//L/K//v8L/+/wv/p/yf+//r//f+n//v+j/+/8H/o//H//v+j/y/+v/2/+v/o//v8r/o/9f+//6/6v+//xv/r/E//f6H//v8D//v+j/+/wv/H/j/+v/r/+v/9/6v+//xv/r/G/+v/B/+/8v//f+//P/q//v/D//f9r//f8T/1/wP/r/A//v8j//v8H/6f+v//f+B/6n/d/+v+//5f+//V//v/h/+v+//+/8v/p/5/+X+r//P+j/+f+//s/wP/z//P/t/m/+v+t//v8n//f+//z/+v/t/7/+j/8f8v//v+//L/t/+f+//o//H/L//f+//t/+v/B//P+//9f/z//X/D/9/+H//v+P/8f+L/9/+r/6f+n//P8b//P8j//v8r//v+x//v+//5f+//q/+n//P8T/+/xf//f8n//v+b//f9r//P+v//f8j//P/t/+v+v/9/+v/o/+/0//v/F//P8v/o/0f+//E//v/L/+/0v//f+//if9/+T//v+t/7/+D//v+D/9f+D/8v8H//P+L//v+T//v+t/+v+t/7v+t/7v/T//f+//g/+f+//k//X/H//v8n//v8n//f8H//v8H/w/+3/5f+T//f+v//f8X//P/j//v+D//v8b//f+L//P8T/+/xf/L/K//v8r//f8r//v+t//f9r//P/p//v+x/z/+v/z/6/+D//v/B/+/8n//f8j/6f8H//v+//z//P/R/+v+j/8f+//x/+v+//5f6f/+/0//v/N/+v+v//P+j//P+t//v+v/6/+v/i/+v+j/+/8H/o/+n/V//f+//t/7f83/6/53+v/B//v8D//v8L/+/8X/+/wP/v/L//f/j/+f/H//f8//d/+f//v+v//f+r/6f+//t/yf+//B/8/+B/+v+//+f+n//v8b/9/+v//f+L//v+//L/K//v8L/y/+v/h/6v+//w/+v+//o/+v+//+/y//v/p/y//f/r/S//v+n//v+D//v8H//v+B//v+j/+/wv/p/qf+//T//v8H/y/+D/z/+H//v8L/y/+v//v/j/y/+//r/+f+//x/6v/h/w/+n/l/+f+D/z/+v/i/1P/H//P+//U//v/p/9/+j//P+//y/+/8L/6/+j//v+D/+/wP/b/y/+f+//q/+v//f/r//f/j/q/+f//v+B//P+j/+/wP/b/y/+v/p/+/0v//P8j/6/+P/8f8v//f/x//f+//+/8v//P+//6f+v//v+L/9/+t//P+j/8f+f/z/+v//v+//o/+n//v+D//v+T//f+T//v8H/+/wP/L/K//v8v//f+//P//f+//z//r/B//v8H//f6H//v8n//f+//z/+v/l/g/+P+//o/+v+//+f+//p//v+v//v+//P//f+//n//v+v/6/+v//v+j/+/wP/b/B/+/wv/p/qf+//T/y/+j/6f8v//f+//x/6f+n//f+j//v+r/+/6f//v+r/6f+D/+/8v/9/+j/+f+//k/+P//P8T/1/wv/r/L//f8X/x/5f+//N/6v+X+//+f//v+b/g/+f//v8j/y/+/7P//P+//6/yf//P8T/+/yv//v+D/+/8H//P+L/4/+//p/+/0v//P+//+//S//v8T/+/wP/r/L//f8j/9/+f/2/+n//P+//8v+3//f+f/2f9z//f9L/y/+f//f+b//f9r/7/w//P8T/+/wP/b/y//f+D//v8v//f+L//f8X//P+j/+v+v//f+r//f/r/+v/9/6v+//jf+n/N/8/+T/y/8v/V//f+//t/+f+D//v8v//f+v//P8L/6/+T/+/8X//v+D//v8H/y/8v/B//f8v//v+j/+/wP/v/L//f8j/9/+j//v8r//f+//v/6/+r/9f9L/+/yP+//p//v+D/+//s/y/+j//v8H/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P+B//v+j/+/yP/p/y//f/r/+f+v/p//v+v//v+t//v+D/y/+n//P+//y/+v/B//P+//9f/L//v+H/4/+v/s/4v8H/5/+P//P+D/tf8H/1/zv//v6P/B/+v8D//v8H/y/+v/B/+v+r/i//f/P//f+r/t/+v/p//v+v//f/L//v8v//f+//P/q//P/p/+/wP/L/C/+v8L//P+j/+v+j/+/wP/L/C/+v8T/9/+T//v+t//f+D//v+j/+/yP/p/qf+//T/y/+j/6f8v//f+//p/+f+//kf9f+//x/6v/h/4f/L/C/+v8L//v+D//v8v//f8T/+/wP/b/y//f+D//v8L//P8T/+/wP/r/K//v8v//v+t//f9r//f/j/+f+H//v8n//f+n//P8L//v8D//v+D/+/yv/r/S//P8T//v8j/9/+t//v+b//f9r//P/j/+f+H//P8T/y/wP/7/G/+v/B/+/wv/r/E/+/yP/r/K//v+b/2/+v/b/+v/9/+n/o/+n/1/8P/j/zP/X+n/7f7v/l/l/+n/F/7v/D/x//P/g/6v+j/k/+f+//o/+f//P+j/i//P/h//P/j//P/z//P+//v/kf/X/k/+v/B//v8H//P+D/+/wv/r/E/+v8D//v8v//f+j//v8H/6f+v//f+B//v+j/y/+v/2/+v//v+//3/o/+X//v+D//v/B/+P8v//f+D/x/yf//f+//X/p/+/6f//v9b//f+T//v8v//f+//P//f+//v/+f//v+v//P+j/8f+L//P8T/+/yP/r/S//v+p//v8v//f+D//v+//L/t//f+//2f+//t//f+//o//H/L//v+b//f9r//P/t/+v+v//v+t//v/p/+/0v//P+L//v8X/+/wP/r/r/+/yP//v+//yf+v/l/r/+f+//x/q/+v+//6/+v/p/6v+//jf+v/B//P8r/y/yv/X/i//v/B/+f+L//P8r//f8D/+/yv/x/6/+v/p/+/0v//f+//v/t/7f83/5f7X/5f+//U//f/D/t//X/D//P8j/6/+P/8f+L//v/D//v8H//P+L//v8T/+/xP/H/A/+v+n//f8j/6/+v/2/+v+//6/+v/9/+v/o/+/0//v/F//P8v/o/0f/v/z//v+p//f9r//f+//v/+f//v+v//v+//n/9/7f//v9L//f+L//v8v//f8j//v8r//v+t/7/+n//v+v//v+n/wf+/8D//f8r//f8D/+/8j/6f8//X//f9P//f8D//v+D/+/wv/H/j/+f+j/o/+f+//5f6f/+/yv/r/+P/p/x/+f+L//v+D//f+P//v+L//v8v//f+3//v+r//v+L//v+b//v+L//f4v//v+T//f+T/y/+v/2/+f//v+n/1/i/+v+L/9/+L//P/L/y/+v/h/6v+//w/+v+//o/+v+//+/wP/L/C/+v8b/+/xv/r/E/+v8L//v+L//v+j/+/wv/p/yf//f6v+//r/+f+//xv/r/C//v+D/+/wP/b/y//v+r/+/6f//v+v//f8D//v+B//v8r/y/xv/3/xP/v+r//v/D/t//f/J//f/t/+v+//o/+v+//+/8X/x/wv/H/j/+f+j/o/+f+//5f6f/+/wP/b/B/+//U/+f+n//v+P//v8X//P/B//P8b/+/yv/r/E//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf/n//f+//1/+n//v+D//v+j//v+T//v+L//v+//L/C/+v8L/6f+T/6f+//8v+//U//f/D/t//v/t/+/8v/9/6P//v9b/9f5X//v+D/+/yv/r/+n//f/D//v+x/y/+j/+/8v//P8j/6f8//X+//x/2/+f+//x/q/+v+//6/+v/6/+v/+/wv/H/A//v+B//v+j/+/yP/r/A//v+p//v/j/p/+//P//f+r/U//f/D/t//X/D/t//X/j/p/8v/t/7v8//d/+n//f+//k//X+//p/+/0v//P/L//v+x//f+L//v+//L/i//X+j/+/wP/L/K//v8v//f6n/V//P//f4H//v+B//v+D//v+//L/S//v+f+//L//P/J//P+j/+v+x/o/+n/1/if/H/6/+v/i/+v+j/+/8H/o//H//v+T/y/+v/2/+v+//+/wP/L/K//v8L//v+D//v+L//v+T//v+t/+v+t//P/p//v+//g/+f+//k//v+D/8v+//E/+/wf/X/C/+v8b/+/wv/p/if/P+L//v8r/y/xv/3/xP/X/C/+v8L/+/wv/L/K//v8r//f+j//v+j/+/wv/p/6v+//T/+/8n//f+v/9/+n//f+//5f7X+//g/+n/V//P+t//P8b/+/xv/r/E/9f8L/+/xf/L/K//v8b//f/j/+f/H//P8T/+/xf//f8n//f+b//f9r//P+j/+/yP/r/S//P8T/y/8v/B/+v8H//f4H//v+b//v9r//f+v//v+//P//f+r/t/+X+//s/wP/z//P/r/K//v8L/6/+n/+/wP/b/B/+//U/+f+v/z/6/+D//v8v//f+//if+//1//f+r//v9L//f+L//v8L//f8r//P/r/+v+//p/6v+//jf+v/B//P8b/+/8X/+/8X/+/wv/H/j/+f+j/o/+f+//5f6f/+/0//f+B//P+D//P/p/+/0v//P+j/+/yP/p/yf+//if9/+T//v+b/g/+f+//k//X+//z//r/B/+/wv/r/C//v+D/+/wP/L/K//v8r//f8r//v+t//f8j//P/L/+v9T/9f8z//v+v/z/+v/9/6P//f+3//v+T//v8X//v+L//v+j//v+r/6f8H//P8b/+/xv/r/E//v8L/6f+v//f+L/6/+v/1/if/H/6/+//if+//i//X+j/+/yP+//p//v+v//f+//l/t/+n/B/9f8L/+/8X/+/8H/w/+3/5f+T//f+v//f8X//v+x/y/+j/+/8v//P8j/6/+P/9f+//k//v+t/7f+//x/6/+P/+/yv/x/i/+v+//v/8v//f8D//v+v//f8b/9f8r//v8H/y/+v/B/+v+r/i//v+n//v+r/t/+v/p//v+v//v+//P//f+r/t/+v+//qf+//T/y/+n//P+//5v+f/n/9/+j//v+t//v/p/7f+3//v+r/6/8H/5/+P//P+D/+v8n/+/xv/r/E//v8r/y/xv/3/xP/X/j/o/6v+//k//X+//yf