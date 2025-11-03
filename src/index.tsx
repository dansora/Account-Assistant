import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// --- Type Definitions ---
type Transaction = {
  id: number;
  userId: number;
  type: 'income' | 'expense';
  amount: number;
  date: string; // ISO 8601 format
  category: string;
};

type User = {
    id: number;
    fullName: string;
    username: string;
    email: string;
    phone: string;
    avatar: string; // base64
    passwordHash: string;
};

type View = {
  page: 'main' | 'income' | 'expense' | 'settings' | 'detail' | 'history' | 'tax' | 'profile';
  period?: 'daily' | 'weekly' | 'monthly';
  transactionType?: 'income' | 'expense';
};

type Theme = 'light' | 'dark' | 'auto';
type FontSize = 'small' | 'medium' | 'large';
type Language = 'en' | 'ro';

type Currency = 'GBP' | 'USD' | 'CAD' | 'AUD' | 'EUR' | 'JPY' | 'CNY' | 'CHF' | 'INR';

// --- Simulated Supabase Client ---
// In a real app, this would be in its own file and use the Supabase SDK.
// Here, we simulate the async nature of a database with localStorage.
const supabaseClient = {
    // Simulate a network delay
    _delay: (ms: number) => new Promise(res => setTimeout(res, ms)),

    async getTransactions(userId: number): Promise<Transaction[]> {
        await this._delay(200);
        const allTransactions: Transaction[] = JSON.parse(localStorage.getItem('transactions') || '[]');
        return allTransactions.filter(tx => tx.userId === userId);
    },

    async addTransaction(transaction: Omit<Transaction, 'id' | 'date'>): Promise<Transaction> {
        await this._delay(150);
        const allTransactions: Transaction[] = JSON.parse(localStorage.getItem('transactions') || '[]');
        const newTransaction: Transaction = {
            ...transaction,
            id: Date.now(),
            date: new Date().toISOString(),
        };
        allTransactions.push(newTransaction);
        localStorage.setItem('transactions', JSON.stringify(allTransactions));
        return newTransaction;
    },

    async _getUsers(): Promise<User[]> {
        await this._delay(100);
        return JSON.parse(localStorage.getItem('users') || '[]');
    },
    
    async getUserById(userId: number): Promise<User | null> {
        await this._delay(50);
        const allUsers = await this._getUsers();
        return allUsers.find(u => u.id === userId) || null;
    },

    async addUser(user: Omit<User, 'id'>): Promise<User> {
        await this._delay(250);
        const allUsers = await this._getUsers();
        if (allUsers.some(u => u.email === user.email)) {
            throw new Error('User with this email already exists.');
        }
        const newUser: User = { ...user, id: Date.now() };
        allUsers.push(newUser);
        localStorage.setItem('users', JSON.stringify(allUsers));
        return newUser;
    },

    async updateUser(updatedUser: User): Promise<User> {
        await this._delay(200);
        const allUsers = await this._getUsers();
        const userIndex = allUsers.findIndex(u => u.id === updatedUser.id);
        if (userIndex > -1) {
            allUsers[userIndex] = updatedUser;
            localStorage.setItem('users', JSON.stringify(allUsers));
            return updatedUser;
        }
        throw new Error('User not found.');
    },

    async login(email: string, pass: string): Promise<User | null> {
        await this._delay(300);
        const allUsers = await this._getUsers();
        const foundUser = allUsers.find(u => u.email === email && u.passwordHash === pass);
        return foundUser || null;
    }
};


// --- Constants & Utilities ---
const currencyMap: Record<Currency, string> = {
  'GBP': '£', 'USD': '$', 'CAD': 'CA$', 'AUD': 'A$', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'CHF': 'Fr', 'INR': '₹',
};

const languageToLocaleMap: Record<Language, string> = {
  'en': 'en-GB',
  'ro': 'ro-RO',
};

const translations: Record<string, Record<Language, string>> = {
  // General
  income: { en: 'Income', ro: 'Venit' },
  expense: { en: 'Expense', ro: 'Cheltuială' },
  balance: { en: 'Balance', ro: 'Balanță' },
  daily: { en: 'Daily', ro: 'Zilnic' },
  weekly: { en: 'Weekly', ro: 'Săptămânal' },
  monthly: { en: 'Monthly', ro: 'Lunar' },
  back: { en: 'Back', ro: 'Înapoi' },
  week: { en: 'Week', ro: 'Săptămâna'},
  
  // Header
  welcome: { en: 'Welcome to Account Assistant', ro: 'Bun venit la Asistentul Contabil' },
  slogan: { en: 'Your Accountancy Assistant for MTD', ro: 'Asistentul tău Contabil pentru MTD' },
  
  // Footer
  home: { en: 'Home', ro: 'Acasă' },
  tax: { en: 'Tax', ro: 'Taxe' },
  settings: { en: 'Settings', ro: 'Setări' },
  
  // Main Page
  dashboard: { en: 'Dashboard', ro: 'Panou de control' },
  
  // Income/Expense Pages
  add_income: { en: 'Add Income', ro: 'Adaugă Venit' },
  add_expense: { en: 'Add Expense', ro: 'Adaugă Cheltuială' },
  income_breakdown: { en: '{period} Income Breakdown', ro: 'Detalii Venituri {period}' },
  expense_breakdown: { en: '{period} Expense Breakdown', ro: 'Detalii Cheltuieli {period}' },
  
  // Numpad
  add_entry: { en: 'Add Entry', ro: 'Adaugă Înregistrare' },
  clear: { en: 'Clear', ro: 'Șterge' },
  enter: { en: 'Enter', ro: 'Introdu' },
  
  // Detail Pages
  todays_type: { en: 'Today\'s {type}', ro: '{type} de Azi' },
  no_transactions_today: { en: 'No transactions for today.', ro: 'Nicio tranzacție azi.' },
  this_weeks_type: { en: 'This Week\'s {type}', ro: '{type} Săptămâna Aceasta' },
  no_transactions_week: { en: 'No transactions for this week.', ro: 'Nicio tranzacție săptămâna aceasta.' },
  this_months_type: { en: 'This Month\'s {type}', ro: '{type} Luna Aceasta' },
  view_history: { en: 'View History', ro: 'Vezi Istoric' },
  no_transactions_month: { en: 'No transactions for this month.', ro: 'Nicio tranzacție luna aceasta.' },
  
  // History Page
  monthly_history: { en: 'Monthly {type} History', ro: 'Istoric Lunar {type}' },

  // Category Breakdown
  no_transactions_period: { en: 'No transactions for this period.', ro: 'Nicio tranzacție pentru această perioadă.'},
  
  // Settings Page
  appearance: { en: 'Appearance', ro: 'Aspect' },
  light: { en: 'Light', ro: 'Luminos' },
  dark: { en: 'Dark', ro: 'Întunecat' },
  auto: { en: 'Auto', ro: 'Automat' },
  font_size: { en: 'Font Size', ro: 'Dimensiune Font' },
  small: { en: 'Small', ro: 'Mic' },
  medium: { en: 'Medium', ro: 'Mediu' },
  large: { en: 'Large', ro: 'Mare' },
  currency: { en: 'Currency', ro: 'Monedă' },
  contact_us: { en: 'Contact Us', ro: 'Contactează-ne' },
  contact_intro: { en: 'Have a question or feedback? We\'d love to hear from you.', ro: 'Ai o întrebare sau un feedback? Ne-ar plăcea să auzim de la tine.' },
  
  // Contact Modal
  contact_name: { en: 'Name', ro: 'Nume' },
  contact_your_name: { en: 'Your Name', ro: 'Numele tău' },
  contact_email: { en: 'Email', ro: 'Email' },
  contact_your_email: { en: 'your@email.com', ro: 'emailul@tau.com' },
  contact_phone: { en: 'Phone Number (Optional)', ro: 'Număr de Telefon (Opțional)' },
  contact_your_phone: { en: 'Your Phone Number', ro: 'Numărul tău de telefon' },
  contact_message: { en: 'Message', ro: 'Mesaj' },
  contact_enter_message: { en: 'Enter your message here...', ro: 'Introdu mesajul tău aici...' },
  send_message: { en: 'Send Message', ro: 'Trimite Mesaj' },

  // Tax Page
  tax_report: { en: 'Tax Report', ro: 'Raport Fiscal' },
  tax_subtitle: { en: 'Select a period to generate your report.', ro: 'Selectează o perioadă pentru a genera raportul.' },
  start_date: { en: 'Start Date', ro: 'Data de început' },
  end_date: { en: 'End Date', ro: 'Data de sfârșit' },
  select_date: { en: 'Select a date', ro: 'Selectează o dată' },
  report_summary: { en: 'Report Summary', ro: 'Sumar Raport' },
  total_income: { en: 'Total Income:', ro: 'Venit Total:' },
  total_expense: { en: 'Total Expense:', ro: 'Cheltuieli Totale:' },
  download_csv: { en: 'Download Report (.csv)', ro: 'Descarcă Raport (.csv)' },
  send_email: { en: 'Send Email', ro: 'Trimite Email' },

  // Auth & Profile
  login: { en: 'Login', ro: 'Autentificare' },
  signup: { en: 'Sign Up', ro: 'Înregistrare' },
  email_address: { en: 'Email Address', ro: 'Adresă de Email' },
  password: { en: 'Password', ro: 'Parolă' },
  full_name: { en: 'Full Name', ro: 'Nume Complet' },
  username: { en: 'Username', ro: 'Nume utilizator' },
  no_account: { en: "Don't have an account? Sign Up", ro: 'Nu ai cont? Înregistrează-te' },
  has_account: { en: 'Already have an account? Login', ro: 'Ai deja cont? Autentifică-te' },
  logout: { en: 'Logout', ro: 'Deconectare' },
  profile: { en: 'Profile', ro: 'Profil' },
  phone_number: { en: 'Phone Number', ro: 'Număr de Telefon' },
  profile_picture: { en: 'Profile Picture', ro: 'Poză de Profil' },
  update_profile: { en: 'Update Profile', ro: 'Actualizează Profilul' },
  login_failed: { en: 'Invalid email or password.', ro: 'Email sau parolă invalidă.' },
  signup_failed: { en: 'An account with this email already exists.', ro: 'Există deja un cont cu acest email.' },
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
  getWeekOfMonth: (date: Date, t: (key: string) => string) => {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    const offsetDate = date.getDate() + firstDayOfMonth - 1;
    return `${t('week')} ${Math.floor(offsetDate / 7) + 1}`;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};


// --- Current Date Time Component ---
const CurrentDateTime = ({ locale }: { locale: string }) => {
    const [dateTime, setDateTime] = useState(new Date());

    useEffect(() => {
        const timerId = setInterval(() => setDateTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);

    const formattedDateTime = dateTime.toLocaleString(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    return (
        <div className="current-datetime">
            <p>{formattedDateTime}</p>
        </div>
    );
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
const NumpadModal = ({ isOpen, onClose, onSubmit, title, currencySymbol, categories, t }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (amount: number, category: string) => void;
    title: string;
    currencySymbol: string;
    categories?: string[];
    t: (key: string) => string;
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
           <h3>{title || t('add_entry')}</h3>
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
          <button onClick={handleClear} className="numpad-button action">{t('clear')}</button>
        </div>
        <button onClick={handleEnter} className="numpad-enter-button">{t('enter')}</button>
      </div>
    </div>
  );
};

// --- Detail Page Components ---
const DetailHeader = ({ title, onBack, t }: { title: string; onBack: () => void; t: (key: string) => string}) => (
  <div className="detail-header">
    <button onClick={onBack} className="back-button">&larr; {t('back')}</button>
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

const DailyDetailPage = ({ transactions, type, onBack, currencySymbol, t }: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  onBack: () => void;
  currencySymbol: string;
  t: (key: string, replacements?: Record<string, string>) => string;
}) => {
  const title = t('todays_type', { type: t(type) });
  return (
    <div className="page-content">
      <DetailHeader title={title} onBack={onBack} t={t} />
      <ul className="transaction-list">
        {transactions.length > 0 ? (
          transactions.map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)
        ) : <p>{t('no_transactions_today')}</p>}
      </ul>
    </div>
  );
};

const WeeklyDetailPage = ({ transactions, type, onBack, currencySymbol, t }: {
  transactions: Transaction[];
  type: 'income' | 'expense';
  onBack: () => void;
  currencySymbol: string;
  t: (key: string, replacements?: Record<string, string>) => string;
}) => {
  const title = t('this_weeks_type', { type: t(type) });
  const groupedByDay = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => {
    const day = new Date(tx.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!acc[day]) acc[day] = [];
    acc[day].push(tx);
    return acc;
  }, {});

  return (
    <div className="page-content">
      <DetailHeader title={title} onBack={onBack} t={t}/>
      {Object.keys(groupedByDay).length > 0 ? (
        Object.entries(groupedByDay).map(([day, txs]) => (
          <div key={day}>
            <h3 className="list-group-header">{day}</h3>
            <ul className="transaction-list">
              {(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)}
            </ul>
          </div>
        ))
      ) : <p>{t('no_transactions_week')}</p>}
    </div>
  );
};

const MonthlyDetailPage = ({ transactions, type, onBack, onViewHistory, currencySymbol, t }: {
    transactions: Transaction[];
    type: 'income' | 'expense';
    onBack: () => void;
    onViewHistory: () => void;
    currencySymbol: string;
    t: (key: string, replacements?: Record<string, string>) => string;
}) => {
    const title = t('this_months_type', { type: t(type) });
    const groupedByWeek = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => {
        const week = dateUtils.getWeekOfMonth(new Date(tx.date), t);
        if (!acc[week]) acc[week] = [];
        acc[week].push(tx);
        return acc;
    }, {});

    return (
        <div className="page-content">
            <DetailHeader title={title} onBack={onBack} t={t} />
            <button className="action-button" onClick={onViewHistory}>{t('view_history')}</button>
            {Object.keys(groupedByWeek).length > 0 ? (
                Object.entries(groupedByWeek).map(([week, txs]) => (
                    <div key={week}>
                        <h3 className="list-group-header">{week}</h3>
                        <ul className="transaction-list">
                            {(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} />)}
                        </ul>
                    </div>
                ))
            ) : <p>{t('no_transactions_month')}</p>}
        </div>
    );
};

const HistoryPage = ({ transactions, type, onBack, currencySymbol, t }: {
    transactions: Transaction[];
    type: 'income' | 'expense';
    onBack: () => void;
    currencySymbol: string;
    t: (key: string, replacements?: Record<string, string>) => string;
}) => {
    const title = t('monthly_history', { type: t(type) });
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
            <DetailHeader title={title} onBack={onBack} t={t}/>
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

// --- Category Breakdown Component ---
const CategoryBreakdown = ({ title, transactions, totalAmount, currencySymbol, type, t }: {
    title: string;
    transactions: Transaction[];
    totalAmount: number;
    currencySymbol: string;
    type: 'income' | 'expense';
    t: (key: string) => string;
}) => {
    const breakdown = useMemo(() => {
        if (totalAmount === 0) return [];
        const grouped = transactions.reduce((acc, tx) => {
            if (tx.type === type) {
                 acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
            }
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(grouped)
            .map(([category, amount]) => ({
                category,
                amount,
                percentage: (amount / totalAmount) * 100,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [transactions, totalAmount, type]);

    return (
        <div className="category-breakdown-container">
            <h3>{title}</h3>
            {breakdown.length > 0 ? (
                <ul className="category-list">
                    {breakdown.map(({ category, amount, percentage }) => (
                        <li key={category} className="category-item">
                            <div className="category-info">
                                <span className="category-name">{category}</span>
                                <span className={`category-amount amount ${type}`}>{currencySymbol}{amount.toFixed(2)}</span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className={`progress-bar ${type}`}
                                    style={{ width: `${percentage}%` }}
                                    role="progressbar"
                                    aria-valuenow={percentage}
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-label={`${category} accounts for ${percentage.toFixed(1)}%`}
                                ></div>
                            </div>
                            <span className="category-percentage">{percentage.toFixed(1)}%</span>
                        </li>
                    ))}
                </ul>
            ) : <p>{t('no_transactions_period')}</p>}
        </div>
    );
};


// --- Main Page Components ---
const MainPage = ({ income, expenses, onNavClick, currencySymbol, currentPeriod, onPeriodChange, locale, t }: {
  income: number;
  expenses: number;
  onNavClick: (page: 'income' | 'expense') => void;
  currencySymbol: string;
  currentPeriod: 'daily' | 'weekly' | 'monthly';
  onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void;
  locale: string;
  t: (key: string) => string;
}) => {
  const balance = (income - expenses).toFixed(2);
  return (
    <div className="page-content">
      <CurrentDateTime locale={locale} />
      <h2>{t('dashboard')}</h2>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onNavClick('income')}>
          <div className="card-label"><h3>{t('income')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled expense clickable" onClick={() => onNavClick('expense')}>
          <div className="card-label"><h3>{t('expense')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled balance">
          <div className="card-label"><h3>{t('balance')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{balance}</p></div>
        </div>
      </div>
      <div className="period-selector">
        <button onClick={() => onPeriodChange('daily')} className={currentPeriod === 'daily' ? 'active' : ''}>{t('daily')}</button>
        <button onClick={() => onPeriodChange('weekly')} className={currentPeriod === 'weekly' ? 'active' : ''}>{t('weekly')}</button>
        <button onClick={() => onPeriodChange('monthly')} className={currentPeriod === 'monthly' ? 'active' : ''}>{t('monthly')}</button>
      </div>
    </div>
  );
};

const IncomePage = ({ income, weeklyIncome, monthlyIncome, addIncome, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: {
  income: number;
  weeklyIncome: number;
  monthlyIncome: number;
  addIncome: (amount: number, category: string) => void;
  onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
  currencySymbol: string;
  dailyTransactions: Transaction[];
  weeklyTransactions: Transaction[];
  monthlyTransactions: Transaction[];
  locale: string;
  t: (key: string, replacements?: Record<string, string>) => string;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const incomeCategories = ['Cash', 'Card', 'Bank Transfer', 'Other'];
  const handleAddIncome = (amount: number, category: string) => { addIncome(amount, category); setIsModalOpen(false); };

  const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions;
  const currentTotal = period === 'daily' ? income : period === 'weekly' ? weeklyIncome : monthlyIncome;
  
  const periodTranslations: Record<string, string> = {
      daily: t('daily'),
      weekly: t('weekly'),
      monthly: t('monthly')
  }

  return (
    <div className="page-content">
      <CurrentDateTime locale={locale} />
      <h2>{t('income')}</h2>
      <button className="action-button" onClick={() => setIsModalOpen(true)}>{t('add_income')}</button>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onCardClick('daily')}>
          <div className="card-label"><h3>{t('daily')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('weekly')}>
          <div className="card-label"><h3>{t('weekly')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{weeklyIncome.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('monthly')}>
          <div className="card-label"><h3>{t('monthly')}</h3></div>
          <div className="card-value"><p className="amount">{currencySymbol}{monthlyIncome.toFixed(2)}</p></div>
        </div>
      </div>
      <CategoryBreakdown 
        title={t('income_breakdown', {period: periodTranslations[period]})}
        transactions={currentTransactions}
        totalAmount={currentTotal}
        currencySymbol={currencySymbol}
        type="income"
        t={t}
      />
      <div className="period-selector">
        <button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button>
        <button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button>
        <button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button>
      </div>
      <NumpadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddIncome} 
        title={t('add_income')} 
        currencySymbol={currencySymbol}
        categories={incomeCategories}
        t={t}
      />
    </div>
  );
};

const ExpensePage = ({ expenses, weeklyExpenses, monthlyExpenses, addExpense, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: {
    expenses: number;
    weeklyExpenses: number;
    monthlyExpenses: number;
    addExpense: (amount: number, category: string) => void;
    onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void;
    currencySymbol: string;
    dailyTransactions: Transaction[];
    weeklyTransactions: Transaction[];
    monthlyTransactions: Transaction[];
    locale: string;
    t: (key: string, replacements?: Record<string, string>) => string;
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const expenseCategories = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];
    const handleAddExpense = (amount: number, category: string) => { addExpense(amount, category); setIsModalOpen(false); };
    
    const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions;
    const currentTotal = period === 'daily' ? expenses : period === 'weekly' ? weeklyExpenses : monthlyExpenses;
    
    const periodTranslations: Record<string, string> = {
      daily: t('daily'),
      weekly: t('weekly'),
      monthly: t('monthly')
    }

    return (
      <div className="page-content">
        <CurrentDateTime locale={locale} />
        <h2>{t('expense')}</h2>
        <button className="action-button expense" onClick={() => setIsModalOpen(true)}>{t('add_expense')}</button>
         <div className="cards-list">
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('daily')}>
            <div className="card-label"><h3>{t('daily')}</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div>
          </div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('weekly')}>
            <div className="card-label"><h3>{t('weekly')}</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{weeklyExpenses.toFixed(2)}</p></div>
          </div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('monthly')}>
            <div className="card-label"><h3>{t('monthly')}</h3></div>
            <div className="card-value"><p className="amount">{currencySymbol}{monthlyExpenses.toFixed(2)}</p></div>
          </div>
        </div>
        <CategoryBreakdown 
            title={t('expense_breakdown', {period: periodTranslations[period]})}
            transactions={currentTransactions}
            totalAmount={currentTotal}
            currencySymbol={currencySymbol}
            type="expense"
            t={t}
        />
        <div className="period-selector">
            <button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button>
            <button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button>
            <button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button>
        </div>
        <NumpadModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            onSubmit={handleAddExpense} 
            title={t('add_expense')} 
            currencySymbol={currencySymbol}
            categories={expenseCategories}
            t={t}
        />
      </div>
    );
};

// --- Contact Modal Component ---
const ContactModal = ({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t: (key: string) => string; }) => {
    const [contactName, setContactName] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPhone, setContactPhone] = useState('');
    const [contactMessage, setContactMessage] = useState('');

    const handleContactSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const subject = `Message from ${contactName} via Account Assistant`;
        const body = `Name: ${contactName}\nEmail: ${contactEmail}\nPhone: ${contactPhone || 'Not provided'}\n\nMessage:\n${contactMessage}`;
        window.location.href = `mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setContactMessage('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{t('contact_us')}</h3>
                    <button onClick={onClose} className="close-button" aria-label="Close modal">&times;</button>
                </div>
                <p className="contact-intro">{t('contact_intro')}</p>
                <form className="contact-form" onSubmit={handleContactSubmit}>
                    <div className="form-field">
                        <label htmlFor="modal-contact-name">{t('contact_name')}</label>
                        <input
                            id="modal-contact-name"
                            type="text"
                            value={contactName}
                            onChange={e => setContactName(e.target.value)}
                            required
                            placeholder={t('contact_your_name')}
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="modal-contact-email">{t('contact_email')}</label>
                        <input
                            id="modal-contact-email"
                            type="email"
                            value={contactEmail}
                            onChange={e => setContactEmail(e.target.value)}
                            required
                            placeholder={t('contact_your_email')}
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="modal-contact-phone">{t('contact_phone')}</label>
                        <input
                            id="modal-contact-phone"
                            type="tel"
                            value={contactPhone}
                            onChange={e => setContactPhone(e.target.value)}
                            placeholder={t('contact_your_phone')}
                        />
                    </div>
                    <div className="form-field">
                        <label htmlFor="modal-contact-message">{t('contact_message')}</label>
                        <textarea
                            id="modal-contact-message"
                            value={contactMessage}
                            onChange={e => setContactMessage(e.target.value)}
                            required
                            rows={5}
                            placeholder={t('contact_enter_message')}
                        />
                    </div>
                    <button type="submit" className="action-button">{t('send_message')}</button>
                </form>
            </div>
        </div>
    );
};

const SettingsPage = ({ theme, onThemeChange, currency, onCurrencyChange, fontSize, onFontSizeChange, t }: {
    theme: Theme;
    onThemeChange: (theme: Theme) => void;
    currency: Currency;
    onCurrencyChange: (currency: Currency) => void;
    fontSize: FontSize;
    onFontSizeChange: (size: FontSize) => void;
    t: (key: string) => string;
}) => {
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  return (
    <div className="page-content">
      <h2>{t('settings')}</h2>
      <div className="settings-group">
        <h3>{t('appearance')}</h3>
        <div className="theme-selector">
          <button onClick={() => onThemeChange('light')} className={theme === 'light' ? 'active' : ''}>{t('light')}</button>
          <button onClick={() => onThemeChange('dark')} className={theme === 'dark' ? 'active' : ''}>{t('dark')}</button>
          <button onClick={() => onThemeChange('auto')} className={theme === 'auto' ? 'active' : ''}>{t('auto')}</button>
        </div>
      </div>
      <div className="settings-group">
        <h3>{t('font_size')}</h3>
        <div className="theme-selector">
          <button onClick={() => onFontSizeChange('small')} className={fontSize === 'small' ? 'active' : ''}>{t('small')}</button>
          <button onClick={() => onFontSizeChange('medium')} className={fontSize === 'medium' ? 'active' : ''}>{t('medium')}</button>
          <button onClick={() => onFontSizeChange('large')} className={fontSize === 'large' ? 'active' : ''}>{t('large')}</button>
        </div>
      </div>
      <div className="settings-group">
        <h3>{t('currency')}</h3>
        <select className="currency-selector" value={currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)}>
          {Object.entries(currencyMap).map(([code, symbol]) => (
            <option key={code} value={code}>{code} ({symbol})</option>
          ))}
        </select>
      </div>
      <div className="settings-group">
        <h3>{t('contact_us')}</h3>
        <p className="contact-intro">{t('contact_intro')}</p>
        <button className="action-button settings-action" onClick={() => setIsContactModalOpen(true)}>{t('contact_us')}</button>
    </div>
    <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} t={t} />
    </div>
  );
};

const TaxPage = ({ transactions, currencySymbol, t }: {
    transactions: Transaction[];
    currencySymbol: string;
    t: (key: string) => string;
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
        const subject = t('tax_report');
        const body = `Hello,\n\nPlease find my tax report attached for the period from ${startDate!.toLocaleDateString()} to ${endDate!.toLocaleDateString()}.\n\nThank you.`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    return (
        <div className="page-content">
            <h2>{t('tax_report')}</h2>
            <p className="page-subtitle">{t('tax_subtitle')}</p>

            <div className="date-selector-container">
                <div className="date-selector" onClick={() => setCalendarOpen('start')}>
                    <label>{t('start_date')}</label>
                    <span>{startDate ? startDate.toLocaleDateString() : t('select_date')}</span>
                </div>
                <div className="date-selector" onClick={() => setCalendarOpen('end')}>
                    <label>{t('end_date')}</label>
                    <span>{endDate ? endDate.toLocaleDateString() : t('select_date')}</span>
                </div>
            </div>

            {reportData && (
                <div className="report-summary">
                    <h3>{t('report_summary')}</h3>
                    <div className="summary-item"><span>{t('total_income')}</span><span className="amount income">{currencySymbol}{reportData.totalIncome.toFixed(2)}</span></div>
                    <div className="summary-item"><span>{t('total_expense')}</span><span className="amount expense">{currencySymbol}{reportData.totalExpense.toFixed(2)}</span></div>
                    <div className="summary-item"><span>{t('balance')}</span><span className="amount balance">{currencySymbol}{reportData.balance.toFixed(2)}</span></div>
                    {!reportReady ?
                       <button className="action-button" onClick={generateCSV}>{t('download_csv')}</button> :
                       <button className="action-button income" onClick={sendEmail}>{t('send_email')}</button>
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
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>;
const TaxIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2H9v-2H7v-2h2V9h2v2h2v2zm4-6V3.5L18.5 9H13z"/></svg>;
const LanguageArrowIcon = () => <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>;


// --- Layout Components ---
const Header = ({ t, language, onLanguageChange, user, onNavClick }: {
    t: (key: string) => string;
    language: Language;
    onLanguageChange: (lang: Language) => void;
    user: User | null;
    onNavClick: (page: string) => void;
}) => (
    <header className="app-header">
        <div className="header-content">
            <h1>{t('welcome')}</h1>
            <p className="slogan">{t('slogan')}</p>
        </div>
        <div className="header-controls">
            <div className="language-selector-wrapper">
                <select
                    className="language-selector"
                    value={language}
                    onChange={(e) => onLanguageChange(e.target.value as Language)}
                    aria-label="Select language"
                >
                    <option value="en">EN</option>
                    <option value="ro">RO</option>
                </select>
                <LanguageArrowIcon />
            </div>
            {user && (
                <button className="profile-button" onClick={() => onNavClick('profile')} aria-label="Go to profile page">
                    {user.avatar ? (
                        <img src={user.avatar} alt="User avatar" className="profile-avatar-icon" />
                    ) : (
                        <div className="profile-initials-icon">
                            {user.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                        </div>
                    )}
                </button>
            )}
        </div>
    </header>
);

const Footer = ({ currentPage, onNavClick, t }: {
  currentPage: string;
  onNavClick: (page: string) => void;
  t: (key: string) => string;
}) => {
  const navItems = [
    { page: 'main', label: t('home'), icon: <HomeIcon /> },
    { page: 'income', label: t('income'), icon: <IncomeIcon /> },
    { page: 'expense', label: t('expense'), icon: <ExpenseIcon /> },
    { page: 'tax', label: t('tax'), icon: <TaxIcon /> },
    { page: 'settings', label: t('settings'), icon: <SettingsIcon /> },
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

const ScrollToTop = ({ mainRef }: { mainRef: React.RefObject<HTMLElement> }) => {
    const [isVisible, setIsVisible] = useState(false);

    const handleScroll = () => {
        if (mainRef.current) {
            setIsVisible(mainRef.current.scrollTop > 300);
        }
    };

    const scrollToTop = () => {
        if (mainRef.current) {
            mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        const mainElement = mainRef.current;
        mainElement?.addEventListener('scroll', handleScroll);
        return () => mainElement?.removeEventListener('scroll', handleScroll);
    }, [mainRef]);

    if (!isVisible) return null;

    return (
        <button className="scroll-to-top-button" onClick={scrollToTop} aria-label="Scroll to top">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
        </button>
    );
};

// --- Profile Page ---
const ProfilePage = ({ user, onUpdate, onLogout, onBack, t }: {
    user: User;
    onUpdate: (updatedUser: User) => void;
    onLogout: () => void;
    onBack: () => void;
    t: (key: string) => string;
}) => {
    const [fullName, setFullName] = useState(user.fullName);
    const [username, setUsername] = useState(user.username);
    const [phone, setPhone] = useState(user.phone);
    const [avatar, setAvatar] = useState(user.avatar);

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const base64 = await fileToBase64(file);
            setAvatar(base64);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate({ ...user, fullName, username, phone, avatar });
    };

    return (
        <div className="page-content">
            <DetailHeader title={t('profile')} onBack={onBack} t={t} />
            <form className="profile-form" onSubmit={handleSubmit}>
                <div className="profile-avatar-section">
                    <img src={avatar || 'https://via.placeholder.com/150'} alt="Profile Avatar" className="profile-avatar-preview" />
                    <label htmlFor="avatar-upload" className="action-button settings-action">{t('profile_picture')}</label>
                    <input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: 'none' }} />
                </div>
                <div className="form-field">
                    <label htmlFor="email">{t('email_address')}</label>
                    <input id="email" type="email" value={user.email} disabled />
                </div>
                <div className="form-field">
                    <label htmlFor="fullName">{t('full_name')}</label>
                    <input id="fullName" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="form-field">
                    <label htmlFor="username">{t('username')}</label>
                    <input id="username" type="text" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>
                <div className="form-field">
                    <label htmlFor="phone">{t('phone_number')}</label>
                    <input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
                <button type="submit" className="action-button">{t('update_profile')}</button>
            </form>
            <button className="action-button expense" onClick={onLogout}>{t('logout')}</button>
        </div>
    );
};


// --- Auth Page ---
const AuthPage = ({ onLogin, onSignup, t }: {
    onLogin: (email: string, pass: string) => Promise<boolean>;
    onSignup: (email: string, pass: string, fullName: string, username: string, phone: string) => Promise<boolean>;
    t: (key: string) => string;
}) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        let success = false;
        if (isLoginView) {
            success = await onLogin(email, password);
            if (!success) setError(t('login_failed'));
        } else {
            success = await onSignup(email, password, fullName, username, phone);
            if (!success) setError(t('signup_failed'));
        }
        setIsSubmitting(false);
    };
    
    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">{isLoginView ? t('login') : t('signup')}</h1>
                <form onSubmit={handleSubmit} className="auth-form">
                    {!isLoginView && (
                        <>
                            <div className="form-field">
                                <label htmlFor="auth-fullname">{t('full_name')}</label>
                                <input id="auth-fullname" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={isSubmitting} />
                            </div>
                            <div className="form-field">
                                <label htmlFor="auth-username">{t('username')}</label>
                                <input id="auth-username" type="text" value={username} onChange={e => setUsername(e.target.value)} required disabled={isSubmitting} />
                            </div>
                        </>
                    )}
                    <div className="form-field">
                        <label htmlFor="auth-email">{t('email_address')}</label>
                        <input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} />
                    </div>
                    <div className="form-field">
                        <label htmlFor="auth-password">{t('password')}</label>
                        <input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isSubmitting} />
                    </div>
                    {!isLoginView && (
                        <div className="form-field">
                            <label htmlFor="auth-phone">{t('phone_number')}</label>
                            <input id="auth-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={isSubmitting} />
                        </div>
                    )}
                    {error && <p className="auth-error">{error}</p>}
                    <button type="submit" className="action-button auth-submit" disabled={isSubmitting}>
                        {isSubmitting ? <div className="button-spinner"></div> : (isLoginView ? t('login') : t('signup'))}
                    </button>
                </form>
                <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="auth-toggle" disabled={isSubmitting}>
                    {isLoginView ? t('no_account') : t('has_account')}
                </button>
            </div>
        </div>
    );
};


// --- Main App Component ---
function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<View>({ page: 'main' });
  
  // User-specific states with defaults
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<Theme>('auto');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [language, setLanguage] = useState<Language>('en');
  const [mainViewPeriod, setMainViewPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const t = useCallback((key: string, replacements: Record<string, string> = {}) => {
      let translation = translations[key]?.[language] || key;
      for (const placeholder in replacements) {
          translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
      }
      return translation;
  }, [language]);

  // Check for active session on initial load
  useEffect(() => {
    const checkSession = async () => {
        const sessionUserId = localStorage.getItem('session_userId');
        if (sessionUserId) {
            const loggedInUser = await supabaseClient.getUserById(parseInt(sessionUserId, 10));
            if (loggedInUser) {
                setUser(loggedInUser);
            }
        }
        setIsLoading(false);
    };
    checkSession();
  }, []);

  // Load user data and settings when user logs in or changes
  useEffect(() => {
      const loadUserData = async () => {
          if (user) {
              const userTransactions = await supabaseClient.getTransactions(user.id);
              setTransactions(userTransactions);
              
              setTheme((localStorage.getItem(`theme_${user.id}`) as Theme) || 'auto');
              setFontSize((localStorage.getItem(`fontSize_${user.id}`) as FontSize) || 'medium');
              setCurrency((localStorage.getItem(`currency_${user.id}`) as Currency) || 'GBP');
              setLanguage((localStorage.getItem(`language_${user.id}`) as Language) || 'en');
          } else {
              // Reset to defaults on logout
              setTransactions([]);
              setTheme('auto');
              setFontSize('medium');
              setCurrency('GBP');
              setLanguage('en');
          }
      };
      loadUserData();
  }, [user]);

  // Save user-specific UI settings
  useEffect(() => { if (user) localStorage.setItem(`language_${user.id}`, language); }, [language, user]);
  useEffect(() => { if (user) localStorage.setItem(`currency_${user.id}`, currency); }, [currency, user]);
  
  useEffect(() => {
    if (user) localStorage.setItem(`theme_${user.id}`, theme);
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => body.classList.toggle('dark-theme', mediaQuery.matches);
      handleChange();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
    }
  }, [theme, user]);

  useEffect(() => {
    if (user) localStorage.setItem(`fontSize_${user.id}`, fontSize);
    const sizeMap: Record<FontSize, string> = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = sizeMap[fontSize];
  }, [fontSize, user]);

  const handleLogin = async (email: string, pass: string) => {
      const foundUser = await supabaseClient.login(email, pass);
      if (foundUser) {
          setUser(foundUser);
          localStorage.setItem('session_userId', String(foundUser.id));
          return true;
      }
      return false;
  };

  const handleSignup = async (email: string, pass: string, fullName: string, username: string, phone: string) => {
    try {
        const newUser = await supabaseClient.addUser({ email, fullName, username, phone, passwordHash: pass, avatar: '' });
        setUser(newUser);
        localStorage.setItem('session_userId', String(newUser.id));
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
  };

  const handleLogout = () => {
      setUser(null);
      setView({ page: 'main' });
      localStorage.removeItem('session_userId');
  };

  const handleUpdateProfile = async (updatedUser: User) => {
    try {
        const result = await supabaseClient.updateUser(updatedUser);
        setUser(result);
        setView({ page: 'main' });
    } catch (error) {
        console.error("Failed to update profile", error);
    }
  };

  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);
  const locale = useMemo(() => languageToLocaleMap[language], [language]);

  const addTransaction = useCallback(async (amount: number, type: 'income' | 'expense', category: string) => {
    if (!user) return;
    const newTransactionData = { userId: user.id, amount, type, category };
    const addedTransaction = await supabaseClient.addTransaction(newTransactionData);
    setTransactions(prev => [...prev, addedTransaction]);
  }, [user]);

  const { 
      dailyIncome, weeklyIncome, monthlyIncome, 
      dailyExpenses, weeklyExpenses, monthlyExpenses,
      dailyTransactions, weeklyTransactions, monthlyTransactions
  } = useMemo(() => {
    const totals = { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0 };
    const filteredLists = { dailyTransactions: [] as Transaction[], weeklyTransactions: [] as Transaction[], monthlyTransactions: [] as Transaction[] };
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      if (dateUtils.isToday(date)) {
        filteredLists.dailyTransactions.push(tx);
        if (tx.type === 'income') totals.dailyIncome += tx.amount; else totals.dailyExpenses += tx.amount;
      }
      if (dateUtils.isThisWeek(date)) {
        filteredLists.weeklyTransactions.push(tx);
        if (tx.type === 'income') totals.weeklyIncome += tx.amount; else totals.weeklyExpenses += tx.amount;
      }
      if (dateUtils.isThisMonth(date)) {
        filteredLists.monthlyTransactions.push(tx);
        if (tx.type === 'income') totals.monthlyIncome += tx.amount; else totals.monthlyExpenses += tx.amount;
      }
    });
    return {...totals, ...filteredLists};
  }, [transactions]);

  const handleNavClick = (page: 'main' | 'income' | 'expense' | 'settings' | 'tax' | 'profile') => setView({ page });
  const handleCardClick = (type: 'income' | 'expense', period: 'daily' | 'weekly' | 'monthly') => setView({ page: 'detail', transactionType: type, period });
  
  if (isLoading) {
      return <div className="loading-spinner"></div>;
  }

  if (!user) {
      return <AuthPage onLogin={handleLogin} onSignup={handleSignup} t={t} />;
  }

  const renderPage = () => {
    const { page, period, transactionType } = view;

    switch (page) {
      case 'profile':
        return <ProfilePage user={user} onUpdate={handleUpdateProfile} onLogout={handleLogout} onBack={() => setView({ page: 'main' })} t={t} />;
      case 'history':
        const allTypeTransactions = transactions.filter(tx => tx.type === transactionType);
        return <HistoryPage transactions={allTypeTransactions} type={transactionType!} onBack={() => handleCardClick(transactionType!, 'monthly')} currencySymbol={currencySymbol} t={t} />;
      case 'detail':
        if (!transactionType || !period) {
          setView({ page: 'main' });
          return null;
        }
        const filters = { daily: dateUtils.isToday, weekly: dateUtils.isThisWeek, monthly: dateUtils.isThisMonth, };
        const relevantTransactions = transactions.filter(tx => tx.type === transactionType && filters[period](new Date(tx.date)));
        const onBack = () => setView({ page: transactionType });
        const onViewHistory = () => setView({ page: 'history', transactionType });

        switch (period) {
          case 'daily': return <DailyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} currencySymbol={currencySymbol} t={t} />;
          case 'weekly': return <WeeklyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} currencySymbol={currencySymbol} t={t} />;
          case 'monthly': return <MonthlyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} onViewHistory={onViewHistory} currencySymbol={currencySymbol} t={t} />;
          default: setView({ page: 'main' }); return null;
        }
      case 'income':
        return <IncomePage income={dailyIncome} weeklyIncome={weeklyIncome} monthlyIncome={monthlyIncome} addIncome={(amount, category) => addTransaction(amount, 'income', category)} onCardClick={(period) => handleCardClick('income', period)} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
      case 'expense':
        return <ExpensePage expenses={dailyExpenses} weeklyExpenses={weeklyExpenses} monthlyExpenses={monthlyExpenses} addExpense={(amount, category) => addTransaction(amount, 'expense', category)} onCardClick={(period) => handleCardClick('expense', period)} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
      case 'settings':
        return <SettingsPage theme={theme} onThemeChange={setTheme} currency={currency} onCurrencyChange={setCurrency} fontSize={fontSize} onFontSizeChange={setFontSize} t={t} />;
      case 'tax':
        return <TaxPage transactions={transactions} currencySymbol={currencySymbol} t={t}/>;
      case 'main':
      default:
        let incomeForPeriod = dailyIncome;
        let expensesForPeriod = dailyExpenses;
        if (mainViewPeriod === 'weekly') { incomeForPeriod = weeklyIncome; expensesForPeriod = weeklyExpenses; }
        else if (mainViewPeriod === 'monthly') { incomeForPeriod = monthlyIncome; expensesForPeriod = monthlyExpenses; }
        return <MainPage income={incomeForPeriod} expenses={expensesForPeriod} onNavClick={(p) => handleNavClick(p as 'income' | 'expense')} currencySymbol={currencySymbol} currentPeriod={mainViewPeriod} onPeriodChange={setMainViewPeriod} locale={locale} t={t} />;
    }
  };

  return (
    <div className="app-container">
      <Header t={t} language={language} onLanguageChange={setLanguage} user={user} onNavClick={handleNavClick as (page: string) => void} />
      <main ref={mainRef}>{renderPage()}</main>
      <Footer currentPage={view.page} onNavClick={handleNavClick as (page: string) => void} t={t} />
      <ScrollToTop mainRef={mainRef} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
