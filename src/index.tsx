import React, { Component, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
import './index.css';
import type { Transaction, User, AppView, Theme, Currency, Language, FontSize, TaxReport } from './types';
import { currencyMap, languageToLocaleMap, translations, fileToBase64, dbTransactionToApp, mapTransactionToDb, dbProfileToApp, appUserToDbProfile, calculatePeriodTotals, generateCsv } from './utils';

// --- Error Boundary ---
interface ErrorBoundaryProps { children?: React.ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public state: ErrorBoundaryState;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

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

const SimpleBarChart = React.memo(({ income, expense, balance, t }: { income: number, expense: number, balance: number, t: (k: string) => string }) => {
    const data = [
        { label: t('income'), value: income, color: '#2ecc71' },
        { label: t('expense'), value: expense, color: '#e74c3c' },
        { label: t('balance'), value: balance, color: '#3498db' }
    ];
    const maxValue = Math.max(income, expense, Math.abs(balance), 1);
    
    return (
        <div className="chart-container">
            <h3>{t('financial_summary')}</h3>
            <svg className="simple-chart" viewBox="0 0 100 60" preserveAspectRatio="none">
                {data.map((d, i) => {
                    const barHeight = Math.max(0, (Math.abs(d.value) / maxValue) * 50);
                    const y = 55 - barHeight;
                    return (
                        <g key={d.label}>
                            <rect x={10 + i * 30} y={y} width="20" height={barHeight} fill={d.color} rx="2" className="chart-bar" />
                            <text x={20 + i * 30} y={y - 2} className="chart-text">{d.value.toFixed(0)}</text>
                            <text x={20 + i * 30} y="65" className="chart-label" style={{fontSize: '6px'}}>{d.label}</text>
                        </g>
                    );
                })}
                <line x1="0" y1="55" x2="100" y2="55" stroke="#eee" strokeWidth="1" />
            </svg>
        </div>
    );
});

const TransactionList = React.memo(({ transactions, currencySymbol, onDelete, onValidate, onEdit, t }: { transactions: Transaction[], currencySymbol: string, onDelete: (id: number) => void, onValidate: (id: number) => void, onEdit: (tx: Transaction) => void, t: (k: string) => string }) => {
    return (
        <div className="transaction-list-container">
            {transactions.length === 0 ? <p style={{textAlign: 'center', color: '#888', padding: '20px'}}>{t('no_transactions_period')}</p> : 
            <ul className="transaction-list">
                {transactions.map(tx => (
                    <li key={tx.id} className={`transaction-item ${tx.validated ? 'validated' : ''}`}>
                        <div className="transaction-details">
                            <span className="transaction-date">{new Date(tx.date).toLocaleDateString()}</span>
                            <span className="transaction-category">{tx.category}</span>
                            {tx.validated && <span className="validated-badge">✓ {t('validated')}</span>}
                            {tx.serviceDescription && <span className="transaction-desc">{tx.serviceDescription}</span>}
                        </div>
                        <div className="transaction-right">
                             <span className={`amount ${tx.type}`}>{currencySymbol}{tx.amount.toFixed(2)}</span>
                             <div className="transaction-actions">
                                 <button onClick={() => onEdit(tx)} className="action-btn edit" title={t('edit')}>✎</button>
                                 <button onClick={() => onValidate(tx.id)} className={`action-btn validate ${tx.validated ? 'active' : ''}`} title={t('validate')}>✓</button>
                                 <button onClick={() => onDelete(tx.id)} className="action-btn delete" title={t('delete')}>🗑</button>
                             </div>
                        </div>
                    </li>
                ))}
            </ul>}
        </div>
    );
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

const ExpenseModal = React.memo(({ isOpen, onClose, onSubmit, initialData, title, currencySymbol, categories, t }: any) => {
    if (!isOpen) return null;
    const [amount, setAmount] = useState(initialData?.amount?.toString() || ''); 
    const [cat, setCat] = useState(initialData?.category || categories?.[0] || 'Other'); 
    const [desc, setDesc] = useState(initialData?.serviceDescription || ''); 
    const [file, setFile] = useState<File | null>(null); 
    const [preview, setPreview] = useState<string | null>(null); 
    const [camOpen, setCamOpen] = useState(false); 
    const [bucket, setBucket] = useState<'receipts'|'invoices'|null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setFile(f); setBucket('invoices'); if (f.type.startsWith('image/')) fileToBase64(f).then(setPreview); else setPreview(f.name); } };
    const handleCam = useCallback((f: File) => { setFile(f); setBucket('receipts'); fileToBase64(f).then(setPreview); setCamOpen(false); }, []);
    const handleCamClose = useCallback(() => setCamOpen(false), []);
    
    return ( <>
        <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <form onSubmit={e => { e.preventDefault(); const v = parseFloat(amount); if (v > 0) onSubmit({ ...initialData, amount: v, category: cat, serviceDescription: desc, file, bucket }); }}>
                <div className="form-field"><label>{t('amount')}</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder={`${currencySymbol}0.00`} /></div>
                <div className="form-field"><label>{t('category')}</label><select value={cat} onChange={e => setCat(e.target.value)}>{categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}</select></div>
                <div className="form-field"><label>{t('description')}</label><textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
                <div className="file-input-buttons"><button type="button" onClick={() => setCamOpen(true)}>{t('take_photo')}</button><button type="button" onClick={() => fileRef.current?.click()}>{t('upload_document')}</button><input type="file" ref={fileRef} onChange={handleFile} accept="image/*,application/pdf" style={{ display: 'none' }} /></div>
                {preview && <div className="file-preview">{file?.type.startsWith('image/') ? <img src={preview} alt="Preview" /> : <span className="file-name">{preview}</span>}<button type="button" className="remove-file-button" onClick={() => { setFile(null); setPreview(null); }}>&times;</button></div>}
                <button type="submit" className="action-button expense" style={{ marginTop: '20px' }}>{initialData ? t('update') : t('add_expense')}</button>
            </form>
        </div></div>
        <CameraModal isOpen={camOpen} onClose={handleCamClose} onCapture={handleCam} t={t} />
    </> );
});

const IncomeNumpadModal = React.memo(({ isOpen, onClose, onSubmit, initialData, title, currencySymbol, categories, t }: any) => {
    if (!isOpen) return null;
    const [val, setVal] = useState(initialData?.amount?.toString() || ''); 
    const [cat, setCat] = useState(initialData?.category || categories?.[0] || 'Other'); 
    const [docType, setDocType] = useState(initialData?.documentType || 'none'); 
    const [extra, setExtra] = useState({ cName: initialData?.clientName || '', cEmail: initialData?.clientEmail || '', desc: initialData?.serviceDescription || '', link: initialData?.paymentLink || '' });
    
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
        <button onClick={() => { const a = parseFloat(val); if (a>0) onSubmit({ ...initialData, amount: a, category: cat, documentType: docType==='none'?undefined:docType, clientName: extra.cName, clientEmail: extra.cEmail, serviceDescription: extra.desc, paymentLink: extra.link }); }} className="numpad-enter-button">{t('enter')}</button>
    </div></div> );
});

// --- Pages ---
const AuthPage = React.memo(({ t }: { t: (k: string) => string }) => {
    const [isLogin, setIsLogin] = useState(true); const [email, setEmail] = useState(''); const [pass, setPass] = useState(''); const [msg, setMsg] = useState({ type: '', text: '' });
    const handleAuth = async (e: React.FormEvent) => { e.preventDefault(); setMsg({ type: '', text: '' });
        if (!supabase) { setMsg({ type: 'error', text: 'Supabase not configured.' }); return; }
        const { error } = isLogin ? await supabase.auth.signInWithPassword({ email, password: pass }) : await supabase.auth.signUp({ email, password: pass });
        if (error) { console.error('Auth Error:', error); setMsg({ type: 'error', text: error.message }); } else if (!isLogin) setMsg({ type: 'success', text: t('check_email_confirmation') });
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
        <SimpleBarChart income={income} expense={expenses} balance={income - expenses} t={t} />
        <div className="period-selector">{['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
    </div>
));

const TermsPage = React.memo(({ t }: any) => (
    <div className="page-content">
        <h2>{t('terms_conditions')}</h2>
        <div className="legal-text-container">
            <h3>1. Introduction</h3>
            <p>Welcome to Account Assistant. By using this app, you agree to comply with and be bound by the following terms and conditions.</p>
            <h3>2. User Responsibilities</h3>
            <p>You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.</p>
            <h3>3. Data Usage</h3>
            <p>We use your data solely for providing the functionality of this application. We do not sell your personal data to third parties.</p>
            <h3>4. Financial Advice</h3>
            <p>This application is a tool for record-keeping and does not constitute professional financial or tax advice. Please consult with a qualified accountant for professional advice.</p>
            <h3>5. Changes to Terms</h3>
            <p>We reserve the right to modify these terms at any time. Continued use of the application signifies your acceptance of any adjustments.</p>
        </div>
    </div>
));

const PrivacyPage = React.memo(({ t }: any) => (
    <div className="page-content">
        <h2>{t('privacy_policy')}</h2>
        <div className="legal-text-container">
            <h3>1. Information Collection</h3>
            <p>We collect information you provide directly to us, such as when you create an account, input transaction data, or update your profile.</p>
            <h3>2. Use of Information</h3>
            <p>We use the information we collect to operate and improve our services, including calculating tax estimations and generating reports.</p>
            <h3>3. Data Security</h3>
            <p>We implement reasonable security measures to protect your information. However, no method of transmission over the internet is 100% secure.</p>
            <h3>4. User Rights</h3>
            <p>You have the right to access, correct, or delete your personal data. You can perform these actions directly within the application settings.</p>
            <h3>5. Contact</h3>
            <p>If you have questions about this policy, please contact us via the settings page.</p>
        </div>
    </div>
));

const IncomePage = React.memo(({ income, addIncome, updateTransaction, deleteTransaction, validateTransaction, transactions, period, setPeriod, currencySymbol, locale, t }: any) => {
    const [modalMode, setModalMode] = useState<'create'|'edit'>('create');
    const [selectedTx, setSelectedTx] = useState<Transaction|null>(null);
    const [open, setOpen] = useState(false);

    const handleEdit = (tx: Transaction) => { setSelectedTx(tx); setModalMode('edit'); setOpen(true); };
    const handleSubmit = (data: any) => {
        if (modalMode === 'create') addIncome(data);
        else updateTransaction({...selectedTx, ...data});
        setOpen(false); setSelectedTx(null); setModalMode('create');
    };
    const handleClose = () => { setOpen(false); setSelectedTx(null); setModalMode('create'); };

    const breakdown = useMemo(() => { const map: any = {}; transactions.forEach((tx: Transaction) => { if (tx.type === 'income') map[tx.category] = (map[tx.category] || 0) + tx.amount; }); return Object.entries(map).map(([k, v]: any) => ({ category: k, amount: v, percentage: (v / income) * 100 })).sort((a:any, b:any) => b.amount - a.amount); }, [transactions, income]);

    return ( <div className="page-content"><CurrentDateTime locale={locale} /><h2>{t('income')}</h2><button className="action-button" onClick={() => { setModalMode('create'); setOpen(true); }}>{t('add_income')}</button>
        <div className="cards-list"><div className="income-card-styled income"><div className="card-label"><h3>{t(period)}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div></div>
        <div className="period-selector">{['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
        <div className="category-breakdown-container"><h3>{t('income_breakdown').replace('{period}', t(period))}</h3><ul className="category-list">{breakdown.map((i: any) => <li key={i.category} className="category-item"><div className="category-info"><span className="category-name">{i.category}</span><span className="category-amount amount income">{currencySymbol}{i.amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className="progress-bar income" style={{ width: `${i.percentage}%` }}></div></div><span className="category-percentage">{i.percentage.toFixed(1)}%</span></li>)}</ul></div>
        <TransactionList transactions={transactions} currencySymbol={currencySymbol} onDelete={deleteTransaction} onValidate={validateTransaction} onEdit={handleEdit} t={t} />
        <IncomeNumpadModal key={open ? 'open' : 'closed'} isOpen={open} onClose={handleClose} onSubmit={handleSubmit} initialData={selectedTx} title={modalMode === 'create' ? t('add_income') : t('edit_transaction')} currencySymbol={currencySymbol} categories={INCOME_CATEGORIES} t={t} />
    </div> );
});

const ExpensePage = React.memo(({ expenses, addExpense, updateTransaction, deleteTransaction, validateTransaction, transactions, period, setPeriod, currencySymbol, locale, t }: any) => {
    const [modalMode, setModalMode] = useState<'create'|'edit'>('create');
    const [selectedTx, setSelectedTx] = useState<Transaction|null>(null);
    const [open, setOpen] = useState(false);

    const handleEdit = (tx: Transaction) => { setSelectedTx(tx); setModalMode('edit'); setOpen(true); };
    const handleSubmit = (data: any) => {
        if (modalMode === 'create') addExpense(data);
        else updateTransaction({...selectedTx, ...data});
        setOpen(false); setSelectedTx(null); setModalMode('create');
    };
    const handleClose = () => { setOpen(false); setSelectedTx(null); setModalMode('create'); };

    const breakdown = useMemo(() => { const map: any = {}; transactions.forEach((tx: Transaction) => { if (tx.type === 'expense') map[tx.category] = (map[tx.category] || 0) + tx.amount; }); return Object.entries(map).map(([k, v]: any) => ({ category: k, amount: v, percentage: (v / expenses) * 100 })).sort((a:any, b:any) => b.amount - a.amount); }, [transactions, expenses]);
    
    return ( <div className="page-content"><CurrentDateTime locale={locale} /><h2>{t('expense')}</h2><button className="action-button expense" onClick={() => {setModalMode('create'); setOpen(true);}}>{t('add_expense')}</button>
        <div className="cards-list"><div className="income-card-styled expense"><div className="card-label"><h3>{t(period)}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div></div>
        <div className="period-selector">{['daily', 'weekly', 'monthly', 'yearly'].map(p => <button key={p} onClick={() => setPeriod(p)} className={period === p ? 'active' : ''}>{t(p)}</button>)}</div>
        <div className="category-breakdown-container"><h3>{t('expense_breakdown').replace('{period}', t(period))}</h3><ul className="category-list">{breakdown.map((i: any) => <li key={i.category} className="category-item"><div className="category-info"><span className="category-name">{i.category}</span><span className="category-amount amount expense">{currencySymbol}{i.amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className="progress-bar expense" style={{ width: `${i.percentage}%` }}></div></div><span className="category-percentage">{i.percentage.toFixed(1)}%</span></li>)}</ul></div>
        <TransactionList transactions={transactions} currencySymbol={currencySymbol} onDelete={deleteTransaction} onValidate={validateTransaction} onEdit={handleEdit} t={t} />
        <ExpenseModal key={open ? 'open' : 'closed'} isOpen={open} onClose={handleClose} onSubmit={handleSubmit} initialData={selectedTx} title={modalMode === 'create' ? t('add_expense') : t('edit_transaction')} currencySymbol={currencySymbol} categories={EXPENSE_CATEGORIES} t={t} />
    </div> );
});

const ProfilePage = React.memo(({ user, onUpdate, onDeleteAccount, t }: any) => {
    const [data, setData] = useState<User>((user || {}) as User);
    const handleChange = (e: any) => setData(p => ({ ...p, [e.target.id]: e.target.value }));
    return ( <div className="page-content"><h2>{t('profile')}</h2><form className="profile-form" onSubmit={e => { e.preventDefault(); onUpdate(data); }}>
        <div className="profile-header-section">
            <div className="form-field"><label>{t('username')}</label><input id="username" value={data.username||''} onChange={handleChange} /></div>
            <div className="form-field"><label>{t('email_address')}</label><input id="email" value={data.email||''} disabled /></div>
        </div>
        <h3 className="form-section-header">Personal Information</h3>
        <div className="form-row-2">
            <div className="form-field"><label>{t('first_name')}</label><input id="firstName" value={data.firstName||''} onChange={handleChange} /></div>
            <div className="form-field"><label>{t('last_name')}</label><input id="lastName" value={data.lastName||''} onChange={handleChange} /></div>
        </div>
        <div className="form-field"><label>{t('phone_number')}</label><input id="phone" value={data.phone||''} onChange={handleChange} /></div>
        
        <h3 className="form-section-header">Company Details</h3>
        <div className="form-field"><label>{t('company_name')}</label><input id="companyName" value={data.companyName||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('address')}</label><textarea id="address" value={data.address||''} onChange={handleChange} rows={2} /></div>
        <div className="form-field"><label>{t('vat_rate')} (%)</label><input id="vatRate" type="number" min="0" max="25" value={data.vatRate||0} onChange={e => setData({...data, vatRate: parseFloat(e.target.value)})} /></div>
        
        <h3 className="form-section-header">Bank Information</h3>
        <div className="form-field"><label>{t('bank_name')}</label><input id="bankName" value={data.bankName||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('account_holder_name')}</label><input id="accountHolderName" value={data.accountHolderName||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('account_number')}</label><input id="accountNumber" value={data.accountNumber||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('sort_code')}</label><input id="sortCode" value={data.sortCode||''} onChange={handleChange} /></div>
        <div className="form-field"><label>{t('iban')}</label><input id="iban" value={data.iban||''} onChange={handleChange} /></div>

        <button type="submit" className="action-button" style={{marginTop:'20px'}}>{t('update_profile')}</button>
        <button type="button" className="action-button delete-account-btn" onClick={onDeleteAccount}>{t('delete_account')}</button>
    </form></div> );
});

const SettingsPage = React.memo(({ theme, setTheme, currency, setCurrency, lang, setLang, fontSize, setFontSize, onViewChange, t }: any) => (
    <div className="page-content"><h2>{t('settings')}</h2>
        <div className="settings-group"><h3>{t('appearance')}</h3><div className="theme-selector">{['light', 'dark', 'auto'].map(m => <button key={m} onClick={() => setTheme(m)} className={theme === m ? 'active' : ''}>{t(m)}</button>)}</div></div>
        <div className="settings-group"><h3>{t('font_size')}</h3><div className="theme-selector">{['small', 'medium', 'large', 'xlarge'].map(s => <button key={s} onClick={() => setFontSize(s)} className={fontSize === s ? 'active' : ''}>{t(s)}</button>)}</div></div>
        <div className="settings-group"><h3>{t('currency')}</h3><select className="currency-selector" value={currency} onChange={e => setCurrency(e.target.value)}>{Object.keys(currencyMap).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="settings-group"><h3>Language</h3><div className="theme-selector">{['en', 'ro'].map(l => <button key={l} onClick={() => setLang(l)} className={lang === l ? 'active' : ''}>{l.toUpperCase()}</button>)}</div></div>
        <div className="settings-group">
            <h3>{t('legal')} & {t('about')}</h3>
            <button className="action-button" style={{marginBottom: '10px'}} onClick={() => onViewChange('terms')}>{t('terms_conditions')}</button>
            <button className="action-button" style={{marginBottom: '10px'}} onClick={() => onViewChange('privacy')}>{t('privacy_policy')}</button>
            <button className="action-button" onClick={() => window.location.href = "mailto:support@accountassistant.com"}>{t('contact_us')}</button>
        </div>
    </div>
));

const TaxPage = React.memo(({ transactions, currencySymbol, updateTransaction, deleteTransaction, validateTransaction, onSaveReport, user, onUpdateUser, t }: any) => {
    const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
    const [showTransactions, setShowTransactions] = useState(false);
    const [selectedTx, setSelectedTx] = useState<Transaction|null>(null);
    const [incomeOpen, setIncomeOpen] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);

    // Filter transactions by date
    const filteredTransactions = useMemo(() => {
        if (!startDate || !endDate) return [];
        const s = new Date(startDate); 
        const e = new Date(endDate); e.setHours(23,59,59,999);
        return transactions.filter((tx: Transaction) => { 
            const d = new Date(tx.date); 
            return d >= s && d <= e; 
        }).sort((a: Transaction, b: Transaction) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, startDate, endDate]);

    const report = useMemo(() => {
        const inc = filteredTransactions.filter((tx:any) => tx.type==='income').reduce((a:number,b:any)=>a+b.amount,0);
        const exp = filteredTransactions.filter((tx:any) => tx.type==='expense').reduce((a:number,b:any)=>a+b.amount,0);
        const taxRate = user?.incomeTaxRate || 0;
        const taxDue = (inc - exp) * (taxRate / 100);
        return { income: inc, expense: exp, balance: inc - exp, taxDue: taxDue > 0 ? taxDue : 0, count: filteredTransactions.length };
    }, [filteredTransactions, user?.incomeTaxRate]);

    const handleEdit = (tx: Transaction) => { 
        setSelectedTx(tx); 
        if (tx.type === 'income') setIncomeOpen(true); else setExpenseOpen(true);
    };
    
    const handleClose = () => { setIncomeOpen(false); setExpenseOpen(false); setSelectedTx(null); };

    const handleIncomeSubmit = (data: any) => { updateTransaction({...selectedTx, ...data}); handleClose(); };
    const handleExpenseSubmit = (data: any) => { updateTransaction({...selectedTx, ...data}); handleClose(); };

    const downloadReport = () => {
        if (!report) return;
        const csv = generateCsv(filteredTransactions, { startDate, endDate, taxRate: user?.incomeTaxRate || 0, totalIncome: report.income, totalExpense: report.expense, taxDue: report.taxDue });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `tax_report_${startDate}_${endDate}.csv`; a.click();
    };

    const emailReport = () => {
        if (!report) return;
        const taxRate = user?.incomeTaxRate || 0;
        const subject = `Tax Report: ${startDate} to ${endDate}`;
        const body = `Report Summary:\n\nIncome: ${currencySymbol}${report.income.toFixed(2)}\nExpense: ${currencySymbol}${report.expense.toFixed(2)}\nBalance: ${currencySymbol}${report.balance.toFixed(2)}\nTax Due (${taxRate}%): ${currencySymbol}${report.taxDue.toFixed(2)}\n\nPlease attach the downloaded CSV report.`;
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    };

    const saveReportToDb = () => {
        if (!report) return;
        onSaveReport({ startDate, endDate, taxRate: user?.incomeTaxRate || 0, totalIncome: report.income, totalExpense: report.expense, taxDue: report.taxDue });
    };

    const updateProfileSetting = (key: string, value: number) => {
        if (!user || !onUpdateUser) return;
        onUpdateUser({ ...user, [key]: value });
    };

    const taxRates = [0, 5, 10, 15, 19, 20, 25, 30, 35, 40, 45, 50];
    const vatRates = [0, 5, 9, 19, 20, 25];

    return (
        <div className="page-content">
            <h2>{t('tax_report')}</h2>
            <div className="date-selector-container">
                <div className="form-field"><label>{t('start_date')}</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
                <div className="form-field"><label>{t('end_date')}</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
            
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px'}}>
                <div className="form-field">
                    <label>{t('tax_rate_label')}</label>
                    <select 
                        value={user?.incomeTaxRate || 0} 
                        onChange={e => updateProfileSetting('incomeTaxRate', parseInt(e.target.value))}
                        style={{padding: '12px', borderRadius: '8px', border: '1px solid #ccc', width: '100%'}}
                    >
                        {taxRates.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                </div>
                <div className="form-field">
                    <label>{t('vat_rate_label')}</label>
                    <select 
                        value={user?.vatRate || 0} 
                        onChange={e => updateProfileSetting('vatRate', parseInt(e.target.value))}
                        style={{padding: '12px', borderRadius: '8px', border: '1px solid #ccc', width: '100%'}}
                    >
                        {vatRates.map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                </div>
            </div>

            {report && startDate && endDate && <div className="report-summary" style={{marginTop: '20px'}}>
                <h3>{t('report_summary')}</h3>
                <div className="summary-item"><span>{t('total_income')}</span><span className="amount income">{currencySymbol}{report.income.toFixed(2)}</span></div>
                <div className="summary-item"><span>{t('total_expense')}</span><span className="amount expense">{currencySymbol}{report.expense.toFixed(2)}</span></div>
                <div className="summary-item"><span>{t('balance')}</span><span className="amount balance">{currencySymbol}{report.balance.toFixed(2)}</span></div>
                <div className="summary-item" style={{borderTop: '2px solid #ccc', marginTop: '10px', paddingTop: '10px'}}>
                    <span style={{fontWeight: 'bold'}}>{t('tax_due')} ({user?.incomeTaxRate}%)</span>
                    <span className="amount" style={{color: '#d35400'}}>{currencySymbol}{report.taxDue.toFixed(2)}</span>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px'}}>
                     <button className="action-button" style={{marginBottom: 0, backgroundColor: '#34495e'}} onClick={saveReportToDb}>{t('save_report')}</button>
                     <button className="action-button" style={{marginBottom: 0, backgroundColor: '#27ae60'}} onClick={downloadReport}>{t('download_csv')}</button>
                     <button className="action-button" style={{marginBottom: 0, backgroundColor: '#2980b9'}} onClick={emailReport}>{t('send_email')}</button>
                     <button className="action-button" style={{marginBottom: 0, backgroundColor: '#8e44ad'}} onClick={() => setShowTransactions(!showTransactions)}>
                         {showTransactions ? t('hide_transactions') : t('view_transactions')}
                     </button>
                </div>
            </div>}
            
            {showTransactions && startDate && endDate && (
                <div style={{marginTop: '30px'}}>
                    <h3>{t('view_transactions')} ({filteredTransactions.length})</h3>
                    <TransactionList transactions={filteredTransactions} currencySymbol={currencySymbol} onDelete={deleteTransaction} onValidate={validateTransaction} onEdit={handleEdit} t={t} />
                </div>
            )}

            <IncomeNumpadModal key={incomeOpen ? 'open-inc' : 'closed-inc'} isOpen={incomeOpen} onClose={handleClose} onSubmit={handleIncomeSubmit} initialData={selectedTx} title={t('edit_transaction')} currencySymbol={currencySymbol} categories={INCOME_CATEGORIES} t={t} />
            <ExpenseModal key={expenseOpen ? 'open-exp' : 'closed-exp'} isOpen={expenseOpen} onClose={handleClose} onSubmit={handleExpenseSubmit} initialData={selectedTx} title={t('edit_transaction')} currencySymbol={currencySymbol} categories={EXPENSE_CATEGORIES} t={t} />
        </div>
    );
});

// --- App Component ---
function App() {
  const [user, setUser] = useState<User | null>(null); const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<AppView>({ page: 'main' }); const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'auto');
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('currency') as Currency) || 'GBP');
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem('fontSize') as FontSize) || 'medium');
  const [period, setPeriod] = useState<'daily'|'weekly'|'monthly'|'yearly'>('daily');
  const isMounted = useRef(true);

  const t = useCallback((k: string) => translations[k]?.[lang] || k, [lang]);
  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);
  const locale = useMemo(() => languageToLocaleMap[lang], [lang]);

  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  useEffect(() => {
    localStorage.setItem('theme', theme); document.body.className = theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-theme' : '') : (theme === 'dark' ? 'dark-theme' : '');
    localStorage.setItem('currency', currency); localStorage.setItem('language', lang); localStorage.setItem('fontSize', fontSize);
    const fsMap: Record<FontSize, string> = { small: '14px', medium: '16px', large: '18px', xlarge: '20px' };
    document.documentElement.style.fontSize = fsMap[fontSize];
  }, [theme, currency, lang, fontSize]);

  const fetchTransactions = useCallback(async () => {
      if (!supabase) return;
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (!error && data && isMounted.current) setTransactions(data.map(dbTransactionToApp));
  }, []);

  const fetchUser = useCallback(async (u: any) => {
      if (!supabase) return;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', u.id).single();
      if (isMounted.current) {
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
      if (error) { console.error('Error saving transaction:', error); alert('Failed to save transaction: ' + error.message); }
      else if (data) { setTransactions(p => [dbTransactionToApp(data), ...p]); } else { fetchTransactions(); }
  }, [user, view.page, fetchTransactions]);

  const updateTransaction = useCallback(async (tx: Transaction) => {
      if (!supabase) return;
      const { error } = await supabase.from('transactions').update(mapTransactionToDb(tx)).eq('id', tx.id);
      if (!error) setTransactions(p => p.map(t => t.id === tx.id ? tx : t)); else alert('Update failed: ' + error.message);
  }, []);

  const deleteTransaction = useCallback(async (id: number) => {
      if (!supabase) return;
      if (!window.confirm("Are you sure you want to delete this transaction?")) return;
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (!error) setTransactions(p => p.filter(t => t.id !== id)); else alert('Delete failed: ' + error.message);
  }, []);

  const validateTransaction = useCallback(async (id: number) => {
      if (!supabase) return;
      const tx = transactions.find(t => t.id === id);
      if (!tx) return;
      const newVal = !tx.validated;
      const { error } = await supabase.from('transactions').update({ validated: newVal }).eq('id', id);
      if (!error) setTransactions(p => p.map(t => t.id === id ? { ...t, validated: newVal } : t));
      else alert('Validation failed: ' + error.message);
  }, [transactions]);

  const saveTaxReport = useCallback(async (report: TaxReport) => {
      if (!supabase || !user) return;
      const { error } = await supabase.from('tax_reports').insert({
          user_id: user.id,
          start_date: report.startDate,
          end_date: report.endDate,
          tax_rate: report.taxRate,
          total_income: report.totalIncome,
          total_expense: report.totalExpense,
          tax_due: report.taxDue
      });
      if (error) alert('Failed to save report: ' + error.message);
      else alert('Report saved successfully!');
  }, [user]);

  const updateUser = useCallback(async (updatedUser: User) => {
      if (!supabase) return;
      const { error } = await supabase.from('profiles').upsert({ id: user!.id, ...appUserToDbProfile(updatedUser), updated_at: new Date().toISOString() });
      if (!error) setUser(updatedUser); else alert('Profile update failed: ' + error.message);
  }, [user]);

  const deleteAccount = useCallback(async () => {
      if (!supabase || !user) return;
      if (!window.confirm(t('delete_account_confirm'))) return;
      
      try {
          const { error: txError } = await supabase.from('transactions').delete().eq('user_id', user.id);
          if (txError) throw txError;
          const { error: profError } = await supabase.from('profiles').delete().eq('id', user.id);
          if (profError) throw profError;
          const { error: repError } = await supabase.from('tax_reports').delete().eq('user_id', user.id);
          if (repError && repError.code !== 'PGRST116') throw repError;
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          alert('Account data deleted successfully.');
      } catch (e: any) {
          console.error('Delete account error:', e);
          alert('Failed to delete account data completely: ' + e.message);
      }
  }, [user, t]);

  const totals = useMemo(() => calculatePeriodTotals(transactions), [transactions]);
  const currentTotals = useMemo(() => ({ income: totals[`${period}Income` as keyof typeof totals] as number, expense: totals[`${period}Expenses` as keyof typeof totals] as number }), [totals, period]);
  const currentTransactions = useMemo(() => totals[`${period}Transactions` as keyof typeof totals] as Transaction[], [totals, period]);

  if (!supabase) return <div className="app-container"><div className="error-box"><h3>Configuration Error</h3><p>Supabase not configured.</p></div></div>;
  if (!session) return <AuthPage t={t} />;

  return (
    <ErrorBoundary>
        <div className="app-container">
            <header className="app-header">
                <div className="header-left"><h1>Account Assistant</h1></div>
                <div className="header-right">
                    <button className="profile-icon-btn" onClick={() => setView({page: 'profile'})} title={t('profile')}>👤</button>
                    <button className="logout-icon-btn" onClick={() => supabase.auth.signOut()} title={t('logout')}>🚪</button>
                </div>
            </header>
            <main>
                {view.page === 'main' && <MainPage income={currentTotals.income} expenses={currentTotals.expense} currencySymbol={currencySymbol} period={period} setPeriod={setPeriod} locale={locale} onNav={(p:any) => setView({page:p})} t={t} />}
                {view.page === 'income' && <IncomePage income={currentTotals.income} addIncome={addTransaction} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} validateTransaction={validateTransaction} transactions={currentTransactions.filter(t => t.type === 'income')} period={period} setPeriod={setPeriod} currencySymbol={currencySymbol} locale={locale} t={t} />}
                {view.page === 'expense' && <ExpensePage expenses={currentTotals.expense} addExpense={addTransaction} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} validateTransaction={validateTransaction} transactions={currentTransactions.filter(t => t.type === 'expense')} period={period} setPeriod={setPeriod} currencySymbol={currencySymbol} locale={locale} t={t} />}
                {view.page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} currency={currency} setCurrency={setCurrency} lang={lang} setLang={setLang} fontSize={fontSize} setFontSize={setFontSize} onViewChange={(p:any) => setView({page: p})} t={t} />}
                {view.page === 'profile' && <ProfilePage user={user} onUpdate={updateUser} onDeleteAccount={deleteAccount} t={t} />}
                {view.page === 'tax' && <TaxPage transactions={transactions} currencySymbol={currencySymbol} updateTransaction={updateTransaction} deleteTransaction={deleteTransaction} validateTransaction={validateTransaction} onSaveReport={saveTaxReport} user={user} onUpdateUser={updateUser} t={t} />}
                {view.page === 'terms' && <TermsPage t={t} />}
                {view.page === 'privacy' && <PrivacyPage t={t} />}
            </main>
            <footer className="app-footer"><nav>
                {['main', 'income', 'expense', 'tax', 'settings'].map(p => <button key={p} className={view.page === p ? 'active' : ''} onClick={() => setView({page: p as any})}><span>{t(p === 'main' ? 'home' : p)}</span></button>)}
            </nav></footer>
        </div>
    </ErrorBoundary>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);