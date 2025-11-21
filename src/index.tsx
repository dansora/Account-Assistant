
import React, { useState, useCallback, useEffect, useMemo, useRef, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';
import './index.css';
import { Transaction, User, AppView, Theme, FontSize, Currency, Language } from './types';
import { currencyMap, languageToLocaleMap, translations, dateUtils, fileToBase64, dbTransactionToApp, mapTransactionToDb, dbProfileToApp, appUserToDbProfile, calculatePeriodTotals } from './utils';

// --- Error Boundary Component ---
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
            <div className="error-box"><h3>Something went wrong</h3><p className="error-message">{this.state.error?.message || 'An unexpected error occurred.'}</p><button onClick={() => window.location.reload()} className="action-button" style={{width: 'auto', marginTop: '20px', display: 'inline-block'}}>Reload Page</button></div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Supabase Client Initialization ---
// Casting to any to avoid TS error when vite-env.d.ts is missing or types are not picked up
const env = (import.meta as any).env;
const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseAnonKey = env?.VITE_SUPABASE_ANON_KEY;
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// --- Constants ---
const INCOME_CATEGORIES = ['Cash', 'Card', 'Bank Transfer', 'Other'];
const EXPENSE_CATEGORIES = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];

// --- Components ---
const CurrentDateTime = React.memo(({ locale }: { locale: string }) => {
    const [dateTime, setDateTime] = useState(new Date());
    useEffect(() => { const timerId = setInterval(() => setDateTime(new Date()), 1000); return () => clearInterval(timerId); }, []);
    return (<div className="current-datetime"><p>{dateTime.toLocaleString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p></div>);
});

const CalendarModal = React.memo(({ isOpen, onClose, onSelectDate }: { isOpen: boolean; onClose: () => void; onSelectDate: (date: Date) => void; }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    if (!isOpen) return null;
    const renderCalendar = () => {
        const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>);
        for (let i = 1; i <= daysInMonth; i++) { const d = new Date(year, month, i); days.push(<button key={i} className="calendar-day" onClick={() => { onSelectDate(d); onClose(); }}>{i}</button>); }
        return days;
    };
    return ( <div className="modal-overlay" onClick={onClose}><div className="modal-content calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-header"><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>&lt;</button><span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>&gt;</button></div>
            <div className="calendar-grid"><div className="calendar-day-name">Su</div><div className="calendar-day-name">Mo</div><div className="calendar-day-name">Tu</div><div className="calendar-day-name">We</div><div className="calendar-day-name">Th</div><div className="calendar-day-name">Fr</div><div className="calendar-day-name">Sa</div>{renderCalendar()}</div>
    </div></div> );
});

const CameraModal = React.memo(({ isOpen, onClose, onCapture, t }: { isOpen: boolean; onClose: () => void; onCapture: (file: File) => void; t: (key: string) => string; }) => {
    const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null);
    useEffect(() => {
        if (isOpen) { navigator.mediaDevices.getUserMedia({ video: true }).then(stream => { streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; }).catch(err => { console.error("Cam Error", err); onClose(); }); } 
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
    const [amount, setAmount] = useState(''); const [cat, setCat] = useState(categories?.[0] || 'Other'); const [desc, setDesc] = useState(''); const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState<string | null>(null); const [bucket, setBucket] = useState<'receipts' | 'invoices' | null>(null); const [camOpen, setCamOpen] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setFile(f); setBucket('invoices'); if (f.type.startsWith('image/')) fileToBase64(f).then(setPreview); else setPreview(f.name); } };
    const handleCam = useCallback((f: File) => { setFile(f); setBucket('receipts'); fileToBase64(f).then(setPreview); setCamOpen(false); }, []);
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const val = parseFloat(amount); if (val > 0) { onSubmit({ amount: val, category: cat, description: desc || undefined, file: file || undefined, bucket: bucket || undefined }); onClose(); } };
    return ( <>
        <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <form className="edit-transaction-form" onSubmit={handleSubmit}>
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
    const [val, setVal] = useState(''); const [cat, setCat] = useState(categories?.[0] || 'Other'); const [catOpen, setCatOpen] = useState(false); const [docType, setDocType] = useState('none'); const [cName, setCName] = useState(''); const [cEmail, setCEmail] = useState(''); const [desc, setDesc] = useState(''); const [link, setLink] = useState('');
    const handleNum = (k: string) => { if (k === '.' && val.includes('.')) return; setVal(val + k); };
    const handleSubmit = () => { const amt = parseFloat(val); if (amt > 0) onSubmit({ amount: amt, category: cat, documentType: docType === 'none' ? undefined : docType, clientName: cName || undefined, clientEmail: cEmail || undefined, serviceDescription: desc || undefined, paymentLink: link || undefined }); };
    return ( <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
        <div className="category-selector"><button className="category-display-button" onClick={() => setCatOpen(!catOpen)}><span>{cat}</span><span className={`arrow ${catOpen ? 'up' : 'down'}`}></span></button>{catOpen && <div className="category-dropdown">{categories?.map((c: string) => <button key={c} className="category-dropdown-item" onClick={() => { setCat(c); setCatOpen(false); }}>{c}</button>)}</div>}</div>
        <div className="numpad-display">{currencySymbol}{val || '0.00'}</div>
        <div className="numpad-grid">{['1','2','3','4','5','6','7','8','9','.','0'].map(k => <button key={k} className="numpad-button" onClick={() => handleNum(k)}>{k}</button>)}<button onClick={() => setVal('')} className="numpad-button action">{t('clear')}</button></div>
        <div className="numpad-extra-fields"><label>{t('generate_document')}</label><div className="doc-type-selector">{['none','receipt','invoice'].map(d => <button key={d} onClick={() => setDocType(d)} className={docType === d ? 'active' : ''}>{t(d)}</button>)}</div>
            {docType !== 'none' && <div className="form-field"><input value={cName} onChange={e => setCName(e.target.value)} placeholder={t('client_name')} /><input value={cEmail} onChange={e => setCEmail(e.target.value)} placeholder={t('client_email')} /><input value={link} onChange={e => setLink(e.target.value)} placeholder={t('payment_link')} /><textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder={t('service_description')} rows={2} /></div>}
        </div>
        <button onClick={handleSubmit} className="numpad-enter-button">{t('enter')}</button>
    </div></div> );
});

const DocumentViewerModal = React.memo(({ transaction, user, currencySymbol, onClose, t }: any) => {
    if (!transaction || !user) return null;
    const vat = user.vatRate > 0 ? (transaction.amount / (1 + user.vatRate / 100)) * (user.vatRate / 100) : 0;
    const sub = transaction.amount - vat;
    return ( <div className="modal-overlay" onClick={onClose}><div className="modal-content doc-viewer-modal-content" onClick={e => e.stopPropagation()}>
        <div className="doc-viewer-header"><button onClick={onClose} className="close-button">&times;</button></div>
        <div className="doc-viewer-body"><header className="doc-header">{user.avatar && <img src={user.avatar} className="company-logo" alt="logo" />}<div><h1>{t(transaction.documentType)}</h1><p>#{transaction.documentNumber}</p></div><div><h2>{user.companyName}</h2><p>{user.address}</p></div></header>
            <div className="doc-details"><strong>{t('date_issued')}:</strong> {new Date(transaction.date).toLocaleDateString()}</div>
            <section className="doc-line-items"><table><thead><tr><th>{t('service_description')}</th><th>{t('total')}</th></tr></thead><tbody><tr><td>{transaction.serviceDescription}</td><td>{currencySymbol}{transaction.amount.toFixed(2)}</td></tr></tbody></table></section>
            <section className="doc-totals">{user.vatRate > 0 && <><div className="total-row"><span>{t('subtotal')}</span><span>{currencySymbol}{sub.toFixed(2)}</span></div><div className="total-row"><span>{t('vat')} ({user.vatRate}%)</span><span>{currencySymbol}{vat.toFixed(2)}</span></div></>}<div className="total-row grand-total"><span>{t('total')}</span><span>{currencySymbol}{transaction.amount.toFixed(2)}</span></div></section>
            <footer className="doc-footer"><p>{t(transaction.documentType === 'invoice' ? 'thank_you' : 'payment_received')}</p></footer>
        </div>
        <div className="doc-viewer-actions"><button className="action-button" onClick={() => window.print()}>{t('print')}</button></div>
    </div></div> );
});

const EditTransactionModal = React.memo(({ onClose, onSubmit, transaction, t }: any) => {
    const [data, setData] = useState<Transaction>(transaction);
    const handleChange = (e: any) => { const { name, value } = e.target; setData(p => ({ ...p, [name]: name === 'amount' ? parseFloat(value) : value })); };
    return ( <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}><div className="modal-header"><h3>{t('edit_transaction')}</h3><button onClick={onClose} className="close-button">&times;</button></div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(data); }} className="edit-transaction-form">
            <div className="form-field"><label>{t('amount')}</label><input name="amount" type="number" step="0.01" value={data.amount} onChange={handleChange} required /></div>
            <div className="form-field"><label>{t('category')}</label><select name="category" value={data.category} onChange={handleChange}>{(data.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div className="form-field"><label>{t('date')}</label><input name="date" type="datetime-local" value={new Date(new Date(data.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16)} onChange={e => setData(p => ({ ...p, date: new Date(e.target.value).toISOString() }))} required /></div>
            <button type="submit" className="action-button">{t('update')}</button>
        </form>
    