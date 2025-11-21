import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import './index.css';
import type { Transaction, User, AppView, Theme, Currency, Language } from './types';
import { currencyMap, languageToLocaleMap, translations, fileToBase64, dbTransactionToApp, mapTransactionToDb, dbProfileToApp, appUserToDbProfile, calculatePeriodTotals } from './utils';

// --- Error Boundary ---
interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error("Uncaught error:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center'}}>
            <div className="error-box">
                <h3>Something went wrong</h3>
                <p className="error-message">{this.state.error?.message || 'An unexpected error occurred.'}</p>
                <button onClick={() => window.location.reload()} className="action-button" style={{width: 'auto', marginTop: '20px'}}>Reload Page</button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Supabase Init ---
const env = (import.meta as any).env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// --- Constants ---
const INCOME_CATEGORIES = ['Cash', 'Card', 'Bank Transfer', 'Other'];
const EXPENSE_CATEGORIES = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];

// --- Shared Components ---
const CurrentDateTime = React.memo(({ locale }: { locale: string }) => {
    const [dateTime, setDateTime] = useState(new Date());
    useEffect(() => { const timer = setInterval(() => setDateTime(new Date()), 1000); return () => clearInterval(timer); }, []);
    return (<div className="current-datetime"><p>{dateTime.toLocaleString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p></div>);
});

const CameraModal = React.memo(({ isOpen, onClose, onCapture, t }: { isOpen: boolean; onClose: () => void; onCapture: (file: File) => void; t: (k: string) => string }) => {
    const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);
    useEffect(() => {
        if (isOpen) { navigator.mediaDevices.getUserMedia({ video: true }).then(s => { streamRef.current = s; if (videoRef.current) videoRef.current.srcObject = s; }).catch(() => onClose()); }
        else if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        return () => { if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop()); };
    }, [isOpen, onClose]);
    const handleCapture = () => {
        if (videoRef.current) { const canvas = document.createElement('canvas'); canvas.width = videoRef.current.videoWidth; canvas.height = videoRef.current.videoHeight; canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
            canvas.toBlob(blob => { if (blob) onCapture(new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' })); }, 'image/jpeg', 0.9);
        }
    };
    if (!isOpen) return null;
    return ( <div className="camera-modal-overlay"><div className="camera-modal-content"><video ref={videoRef} autoPlay playsInline muted /><div className="camera-controls"><button onClick={handleCapture} className="capture-button">{t('capture')}</button><button onClick={onClose} className="cancel-button">{t('cancel')}</button></div></div></div> );
});

const ExpenseModal = React.memo(({ onClose, onSubmit, title, currencySymbol, categories, t }: any) => {
    const [amount, setAmount] = useState(''); const [cat, setCat] = useState(categories?.[0] || 'Other'); const [desc, setDesc] = useState(''); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [camOpen, setCamOpen] = useState(false); const [bucket, setBucket] = useState<'receipts'|'invoices'|null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setFile(f); setBucket('invoices'); if (f.type.startsWith('image/')) fileToBase64(f).then(setPreview); else setPreview(f.name); } };
    const handleCam = useCallback((f: File) => { setFile(f); setBucket('receipts'); fileToBase64(f).then(setPreview); setCamOpen(false); }, []);
    return ( <>
        <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <form onSubmit={e => { e.preventDefault(); const v = parseFloat(amount); if (v > 0) onSubmit({ amount: v, category: cat, description: desc, file, bucket }); }}>
                <div className="form-field"><label>{t('amount')}</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder={`${currencySymbol}0.00`} /></div>
                <div className="form-field"><label>{t('category')}</label><select value={cat} onChange={e => setCat(e.target.value)}>{categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-field"><label>{t('description')}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
                <div className="file-input-buttons"><button type="button" onClick={() => setCamOpen(true)}>{t('take_photo')}</button><button type="button" onClick={() => fileRef.current?.click()}>{t('upload_document')}</button><input type="file" ref={fileRef} onChange={handleFile} accept="image/*,application/pdf" style={{ display: 'none' }} /></div>
                {preview && <div className="file-preview">{file?.type.startsWith('image/') ? <img src={preview} alt="Preview" /> : <span className="file-name">{preview}</span>}<button type="button" className="remove-file-button" onClick={() => { setFile(null); setPreview(null); }}>&times;</button></div>}
                <button type="submit" className="action-button expense" style={{ marginTop: '20px' }}>{t('add_expense')}</button>
            </form>
        </div></div>
        <CameraModal isOpen={camOpen} onClose={() => setCamOpen(false)} onCapture={handleCam} t={t} />
    </> );
});

const IncomeNumpadModal = React.memo(({ onClose, onSubmit, title, currencySymbol, categories, t }: any) => {
    const [val, setVal] = useState(''); const [cat, setCat] = useState(categories?.[0] || 'Other'); const [docType, setDocType] = useState('none'); const [extra, setExtra] = useState({ cName: '', cEmail: '', desc: '', link: '' });
    const handleNum = (k: string) => { if (k === '.' && val.includes('.')) return; setVal(val + k); };
    return ( <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
        <div className="category-selector"><select className="category-display-button" value={cat} onChange={e => setCat(e.target.value)} style={{width:'100%', padding: '12px'}}>{categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="numpad-display">{currencySymbol}{val || '0.00'}</div>
        <div className="numpad-grid">{['1','2','3','4','5','6','7','8','9','.','0'].map(k => <button key={k} className="numpad-button" onClick={() => handleNum(k)}>{k}</button>)}<button onClick={() => setVal('')} className="numpad-button action">{t('clear')}</button></div>
        <div className="numpad-extra-fields"><label>{t('generate_document')}</label><div className="doc-type-selector">{['none','receipt','invoice'].map(d => <button key={d} onClick={() => setDocType(d)} className={docType === d ? 'active' : ''}>{t(d)}</button>)}</div>
            {docType !== 'none' && <div className="form-field">
                <input value={extra.cName} onChange={e => setExtra({...extra, cName: e.target.value})} placeholder={t('client_name')} />
                <input value={extra.cEmail} onChange={e => setExtra({...extra, cEmail: e.target.value})} placeholder={t('client_email')} />
                <input value={extra.link} onChange={e => setExtra({...extra, link: e.target.value})} placeholder={t('payment_link')} />
                <textarea value={extra.desc} onChange={e => setExtra({...extra, desc: e.target.value})} placeholder={t('service_description')} rows={2} />
            </div>}
        </div>
        <button onClick={() => { const a = parseFloat(val); if (a>0) onSubmit({ amount: a, category: cat, documentType: docType==='none'?undefined:docType, clientName: extra.cName, clientEmail: extra.cEmail, serviceDescription: extra.desc, paymentLink: extra.link }); }} className="numpad-enter-button">{t('enter')}</button>
    </div></div> );
});

// --- Pages ---
const AuthPage = React.memo(({ onLogin, t }: any) => {
    const [isLogin, setIsLogin] = useState(true); const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [msg, setMsg] = useState({ type: '', text: '' });
    const handleAuth = async (e: React.FormEvent) => { e.preventDefault(); setMsg({ type: '', text: '' });
        if (!supabase) { setMsg({ type: 'error', text: 'Supabase not configured.' }); return; }
        const { error } = isLogin ? await supabase.auth.signInWithPassword({ email, password: pass }) : await supabase.auth.signUp({ email, password: pass });
        if (error) setMsg({ type: 'error', text: error.message }); else if (!isLogin) setMsg({ type: 'success', text: t('check_email_confirmation') });
    };
    return ( <div className="auth-container"><div className="auth-box"><h2 className="auth-title">{t(isLogin ? 'login' : 'signup')}</h2>
        {msg.text && <div className={`auth-${msg.type}`}>{msg.text}</div>}
        <form className="auth-form" onSubmit={handleAuth}>
            <div className="form-field"><label>{t('email_address')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
            <div className="form-field"><label>{t('password')}</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} required /></div>
            <button type="submit" className="action-button auth-submit">{t(isLogin ? 'login' : 'signup')}</button>
        </form>
        <button className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>{t(isLogin ? 'no_account' : 'has_account')}</button>
    </div></div> );
});

const MainPage = React.memo(({ income, expenses, currencySymbol, period, setPeriod, locale, onNav, t }: any) => (
    <div className="page-content">
        <CurrentDateTime locale={locale} /><h2>{t('dashboard')}</h2>
        <div className="cards-list">
            <div className="income-card-styled income clickable" onClick={() => onNav('income')}><div className="card-label"><h3>{t('income')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div>
            <div className="income-card-styled expense clickable" onClick={() => onNav('expense')}><div className="card-label"><h3>{t('expense')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div>
            <div className="income-card-styled balance"><div className="card-label"><h3>{t('balance')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{(income - expenses).toFixed(2)}</p></div></div>
        </div>
        <div className="period-selector">{['daily', 'weekly', 'monthly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
    </div>
));

const IncomePage = React.memo(({ income, addIncome, transactions, period, setPeriod, currencySymbol, locale, t }: any) => {
    const [open, setOpen] = useState(false);
    const breakdown = useMemo(() => { const map: any = {}; transactions.forEach((tx: Transaction) => { if (tx.type === 'income') map[tx.category] = (map[tx.category] || 0) + tx.amount; }); return Object.entries(map).map(([k, v]: any) => ({ category: k, amount: v, percentage: (v / income) * 100 })).sort((a:any, b:any) => b.amount - a.amount); }, [transactions, income]);
    return ( <div className="page-content"><CurrentDateTime locale={locale} /><h2>{t('income')}</h2><button className="action-button" onClick={() => setOpen(true)}>{t('add_income')}</button>
        <div className="cards-list"><div className="income-card-styled income"><div className="card-label"><h3>{t(period)}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div></div>
        <div className="category-breakdown-container"><h3>{t('income_breakdown').replace('{period}', t(period))}</h3><ul className="category-list">{breakdown.map((i: any) => <li key={i.category} className="category-item"><div className="category-info"><span className="category-name">{i.category}</span><span className="category-amount amount income">{currencySymbol}{i.amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className="progress-bar income" style={{ width: `${i.percentage}%` }}></div></div><span className="category-percentage">{i.percentage.toFixed(1)}%</span></li>)}</ul></div>
        <div className="period-selector">{['daily', 'weekly', 'monthly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
        <IncomeNumpadModal key={open ? 'open' : 'closed'} isOpen={open} onClose={() => setOpen(false)} onSubmit={(d: any) => { addIncome(d); setOpen(false); }} title={t('add_income')} currencySymbol={currencySymbol} categories={INCOME_CATEGORIES} t={t} />
    </div> );
});

const ExpensePage = React.memo(({ expenses, addExpense, transactions, period, setPeriod, currencySymbol, locale, t }: any) => {
    const [open, setOpen] = useState(false);
    const breakdown = useMemo(() => { const map: any = {}; transactions.forEach((tx: Transaction) => { if (tx.type === 'expense') map[tx.category] = (map[tx.category] || 0) + tx.amount; }); return Object.entries(map).map(([k, v]: any) => ({ category: k, amount: v, percentage: (v / expenses) * 100 })).sort((a:any, b:any) => b.amount - a.amount); }, [transactions, expenses]);
    return ( <div className="page-content"><CurrentDateTime locale={locale} /><h2>{t('expense')}</h2><button className="action-button expense" onClick={() => setOpen(true)}>{t('add_expense')}</button>
        <div className="cards-list"><div className="income-card-styled expense"><div className="card-label"><h3>{t(period)}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div></div>
        <div className="category-breakdown-container"><h3>{t('expense_breakdown').replace('{period}', t(period))}</h3><ul className="category-list">{breakdown.map((i: any) => <li key={i.category} className="category-item"><div className="category-info"><span className="category-name">{i.category}</span><span className="category-amount amount expense">{currencySymbol}{i.amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className="progress-bar expense" style={{ width: `${i.percentage}%` }}></div></div><span className="category-percentage">{i.percentage.toFixed(1)}%</span></li>)}</ul></div>
        <div className="period-selector">{['daily', 'weekly', 'monthly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
        <ExpenseModal key={open ? 'open' : 'closed'} isOpen={open} onClose={() => setOpen(false)} onSubmit={(d: any) => { addExpense(d); setOpen(false); }} title={t('add_expense')} currencySymbol={currencySymbol} categories={EXPENSE_CATEGORIES} t={t} />
    </div> );
});

const ProfilePage = React.memo(({ user, onUpdate, onLogout, t }: any) => {
    // Cast empty object to User type to satisfy strict TypeScript check
    const [data, setData] = useState<User>((user || {}) as User);
    const handleChange = (e: any) => setData(p => ({ ...p, [e.target.id]: e.target.value }));
    return ( <div className="page-content"><h2>{t('profile')}</h2><form className="profile-form" onSubmit={e => { e.preventDefault(); onUpdate(data); }}>
        <div className="form-field"><label>{t('full_name')}</label><input id="fullName" value={data.fullName||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('email_address')}</label><input id="email" value={data.email||''} disabled /></div>
        <div className="form-field"><label>{t('company_name')}</label><input id="companyName" value={data.companyName||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('vat_rate')} (%)</label><input id="vatRate" type="number" value={data.vatRate||0} onChange={e => setData({...data, vatRate: parseFloat(e.target.value)})} /></div>
        <button type="submit" className="action-button">{t('update_profile')}</button>
        <button type="button" className="action-button expense" onClick={onLogout}>{t('logout')}</button>
    </form></div> );
});

const SettingsPage = React.memo(({ theme, setTheme, currency, setCurrency, lang, setLang, t }: any) => (
    <div className="page-content"><h2>{t('settings')}</h2>
        <div className="settings-group"><h3>{t('appearance')}</h3><div className="theme-selector">{['light', 'dark', 'auto'].map(m => <button key={m} onClick={() => setTheme(m)} className={theme === m ? 'active' : ''}>{t(m)}</button>)}</div></div>
        <div className="settings-group"><h3>{t('currency')}</h3><select className="currency-selector" value={currency} onChange={e => setCurrency(e.target.value)}>{Object.keys(currencyMap).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="settings-group"><h3>Language</h3><div className="theme-selector">{['en', 'ro'].map(l => <button key={l} onClick={() => setLang(l)} className={lang === l ? 'active' : ''}>{l.toUpperCase()}</button>)}</div></div>
    </div>
));

// --- App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null); const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<AppView>({ page: 'main' }); const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'auto');
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('currency') as Currency) || 'GBP');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [period, setPeriod] = useState<'daily'|'weekly'|'monthly'>('daily');
  const isMounted = useRef(true);

  const t = useCallback((k: string) => translations[k]?.[lang] || k, [lang]);
  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);
  const locale = useMemo(() => languageToLocaleMap[lang], [lang]);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  useEffect(() => {
    localStorage.setItem('theme', theme); document.body.className = theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-theme' : '') : (theme === 'dark' ? 'dark-theme' : '');
    localStorage.setItem('currency', currency); localStorage.setItem('language', lang);
  }, [theme, currency, lang]);

  const fetchTransactions = useCallback(async () => {
      if (!supabase) return;
      // Removed user dependency to avoid loop, assuming RLS protects data or session is handled by supabase client
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (!error && data && isMounted.current) setTransactions(data.map(dbTransactionToApp));
  }, []);

  const fetchUser = useCallback(async (u: any) => {
      if (!supabase) return;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', u.id).single();
      if (isMounted.current) {
          // Safely cast the fallback to User type to suppress TypeScript errors
          const fallbackUser = { id: u.id, email: u.email, ...({} as any) } as User;
          setUser(data ? dbProfileToApp(data, u) : fallbackUser);
      }
      if (!error) fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
      if (!supabase) return;
      supabase.auth.getSession().then(({ data: { session } }) => { if(session) { setSession(session); fetchUser(session.user); } });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session); if (session) fetchUser(session.user); else { setUser(null); setTransactions([]); }
      });
      return () => subscription.unsubscribe();
  }, [fetchUser]);

  const addTransaction = useCallback(async (txData: any) => {
      if (!supabase || !user) return;
      const newTx = { ...txData, userId: user.id, type: view.page === 'income' ? 'income' : 'expense', date: new Date().toISOString() };
      if (txData.file && txData.bucket) {
          const ext = txData.file.name.split('.').pop(); const path = `${user.id}/${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage.from(txData.bucket).upload(path, txData.file);
          if (!upErr) { newTx.attachmentUrl = path; newTx.attachmentBucket = txData.bucket; }
      }
      delete newTx.file; delete newTx.bucket;
      const { data, error } = await supabase.from('transactions').insert(mapTransactionToDb(newTx)).select().single();
      if (!error && data) setTransactions(p => [dbTransactionToApp(data), ...p]);
      else if (!error) fetchTransactions(); 
  }, [user, view.page, fetchTransactions]);

  const updateUser = useCallback(async (updatedUser: User) => {
      if (!supabase) return;
      const { error } = await supabase.from('profiles').upsert({ id: user!.id, ...appUserToDbProfile(updatedUser), updated_at: new Date().toISOString() });
      if (!error) setUser(updatedUser);
  }, [user]);

  const totals = useMemo(() => calculatePeriodTotals(transactions), [transactions]);
  const currentTotals = useMemo(() => ({ income: totals[`${period}Income` as keyof typeof totals] as number, expense: totals[`${period}Expenses` as keyof typeof totals] as number }), [totals, period]);
  const currentTransactions = useMemo(() => totals[`${period}Transactions` as keyof typeof totals] as Transaction[], [totals, period]);

  if (!supabase) return <div className="app-container"><div className="error-box"><h3>Configuration Error</h3><p>Supabase not configured.</p></div></div>;
  if (!session) return <AuthPage onLogin={() => {}} t={t} />;

  return (
    <ErrorBoundary>
        <div className="app-container">
            <header className="app-header"><h1>Account Assistant</h1></header>
            <main>
                {view.page === 'main' && <MainPage income={currentTotals.income} expenses={currentTotals.expense} currencySymbol={currencySymbol} period={period} setPeriod={setPeriod} locale={locale} onNav={(p:any) => setView({page:p})} t={t} />}
                {view.page === 'income' && <IncomePage income={currentTotals.income} addIncome={addTransaction} transactions={currentTransactions} period={period} setPeriod={setPeriod} currencySymbol={currencySymbol} locale={locale} t={t} />}
                {view.page === 'expense' && <ExpensePage expenses={currentTotals.expense} addExpense={addTransaction} transactions={currentTransactions} period={period} setPeriod={setPeriod} currencySymbol={currencySymbol} locale={locale} t={t} />}
                {view.page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} t={t} />}
                {view.page === 'profile' && <ProfilePage user={user} onUpdate={updateUser} onLogout={() => supabase.auth.signOut()} t={t} />}
            </main>
            <footer className="app-footer"><nav>
                {['main', 'income', 'expense', 'settings', 'profile'].map(p => <button key={p} className={view.page === p ? 'active' : ''} onClick={() => setView({page: p as any})}><span>{t(p === 'main' ? 'home' : p)}</span></button>)}
            </nav></footer>
        </div>
    </ErrorBoundary>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);