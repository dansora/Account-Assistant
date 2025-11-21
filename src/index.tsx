import React, { Component, useState, useCallback, useEffect, useMemo, useRef, ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient, Session } from '@supabase/supabase-js';
import './index.css';
import { Transaction, User, AppView, Theme, FontSize, Currency, Language } from './types';
import { currencyMap, languageToLocaleMap, translations, dateUtils, fileToBase64, dbTransactionToApp, mapTransactionToDb, dbProfileToApp, appUserToDbProfile } from './utils';

// --- Error Boundary Component ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center'}}>
            <div className="error-box">
                <h3>Something went wrong</h3>
                <p className="error-message">{this.state.error?.message || 'An unexpected error occurred.'}</p>
                <button onClick={() => window.location.reload()} className="action-button" style={{width: 'auto', marginTop: '20px', display: 'inline-block'}}>
                    Reload Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Supabase Client Initialization ---
const getEnv = (key: string) => {
    try {
        // @ts-ignore
        return import.meta.env?.[key] || '';
    } catch (e) {
        console.warn(`Failed to access env var ${key}`, e);
        return '';
    }
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

let supabase: any = null;
let supabaseError: string | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
    supabaseError = 'Application Configuration Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are missing. Please check your environment settings.';
    console.error(supabaseError);
} else {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e: any) {
        supabaseError = `Failed to initialize database connection: ${e.message}`;
        console.error(supabaseError);
    }
}

// --- Constants ---
const INCOME_CATEGORIES = ['Cash', 'Card', 'Bank Transfer', 'Other'];
const EXPENSE_CATEGORIES = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];

// --- Components ---

const CurrentDateTime = ({ locale }: { locale: string }) => {
    const [dateTime, setDateTime] = useState(new Date());
    useEffect(() => {
        const timerId = setInterval(() => setDateTime(new Date()), 1000);
        return () => clearInterval(timerId);
    }, []);
    const formattedDateTime = dateTime.toLocaleString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return (<div className="current-datetime"><p>{formattedDateTime}</p></div>);
};

const CalendarModal = ({ isOpen, onClose, onSelectDate }: { isOpen: boolean; onClose: () => void; onSelectDate: (date: Date) => void; }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    if (!isOpen) return null;
    const changeMonth = (offset: number) => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
    const renderCalendar = () => {
        const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days = Array.from({ length: firstDay }, (_, i) => <div key={`empty-${i}`} className="calendar-day empty"></div>);
        for (let i = 1; i <= daysInMonth; i++) {
            const dayDate = new Date(year, month, i);
            days.push(<button key={i} className="calendar-day" onClick={() => { onSelectDate(dayDate); onClose(); }}>{i}</button>);
        }
        return days;
    };
    return (
        <div className="modal-overlay" onClick={onClose}><div className="modal-content calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-header"><button onClick={() => changeMonth(-1)}>&lt;</button><span>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><button onClick={() => changeMonth(1)}>&gt;</button></div>
            <div className="calendar-grid"><div className="calendar-day-name">Su</div><div className="calendar-day-name">Mo</div><div className="calendar-day-name">Tu</div><div className="calendar-day-name">We</div><div className="calendar-day-name">Th</div><div className="calendar-day-name">Fr</div><div className="calendar-day-name">Sa</div>{renderCalendar()}</div>
        </div></div>
    );
};

const CameraModal = ({ isOpen, onClose, onCapture, t }: { isOpen: boolean; onClose: () => void; onCapture: (file: File) => void; t: (key: string) => string; }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const openCamera = async () => {
            if (isOpen) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    streamRef.current = stream;
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } catch (err) {
                    console.error("Error accessing camera: ", err);
                    alert("Could not access camera. Please ensure permissions are granted.");
                    onClose();
                }
            } else {
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }
            }
        };
        openCamera();
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [isOpen, onClose]);

    const handleCapture = () => {
        if (videoRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            const context = canvas.getContext('2d');
            context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
                if (blob) {
                    const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                }
            }, 'image/jpeg', 0.9);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="camera-modal-overlay">
            <div className="camera-modal-content">
                <video ref={videoRef} autoPlay playsInline muted />
                <div className="camera-controls">
                    <button onClick={handleCapture} className="capture-button">{t('capture')}</button>
                    <button onClick={onClose} className="cancel-button">{t('cancel')}</button>
                </div>
            </div>
        </div>
    );
};

const ExpenseModal = ({ isOpen, onClose, onSubmit, title, currencySymbol, categories, t }: { isOpen: boolean; onClose: () => void; onSubmit: (data: { amount: number, category: string, description?: string, file?: File, bucket?: 'receipts' | 'invoices' }) => void; title: string; currencySymbol: string; categories?: string[]; t: (key: string) => string; }) => {
    const [amount, setAmount] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories && categories.length > 0 ? categories[0] : 'Other');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [attachmentBucket, setAttachmentBucket] = useState<'receipts' | 'invoices' | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = useCallback(() => {
        setAmount('');
        setSelectedCategory(categories && categories.length > 0 ? categories[0] : 'Other');
        setDescription('');
        setFile(null);
        setFilePreview(null);
        setAttachmentBucket(null);
    }, [categories]);

    useEffect(() => {
        if (isOpen) resetState();
    }, [isOpen, resetState]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            setAttachmentBucket('invoices');
            if (selectedFile.type.startsWith('image/')) {
                fileToBase64(selectedFile).then(setFilePreview);
            } else {
                setFilePreview(selectedFile.name);
            }
        }
    };
    
    const handlePhotoCapture = useCallback((capturedFile: File) => {
        setFile(capturedFile);
        setAttachmentBucket('receipts');
        fileToBase64(capturedFile).then(setFilePreview);
        setIsCameraOpen(false);
    }, []);

    const removeFile = () => {
        setFile(null);
        setFilePreview(null);
        setAttachmentBucket(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = () => {
        const numericAmount = parseFloat(amount);
        if (!isNaN(numericAmount) && numericAmount > 0) {
            onSubmit({
                amount: numericAmount,
                category: selectedCategory,
                description: description || undefined,
                file: file || undefined,
                bucket: attachmentBucket || undefined,
            });
            onClose();
        }
    };
    
    const closeCamera = useCallback(() => setIsCameraOpen(false), []);

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
                    <form className="edit-transaction-form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                        <div className="form-field"><label htmlFor="exp-amount">{t('amount')}</label><input id="exp-amount" name="amount" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required placeholder={`${currencySymbol}0.00`} /></div>
                        <div className="form-field"><label htmlFor="exp-category">{t('category')}</label><select id="exp-category" name="category" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>{categories?.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                        <div className="form-field"><label htmlFor="exp-description">{t('description')}</label><textarea id="exp-description" name="description" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="e.g., Office supplies"></textarea></div>
                        <div className="file-input-buttons">
                            <button type="button" onClick={() => setIsCameraOpen(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9.4 11.4 8 13.54V16h4.46l2.14-2.14-1.06-1.06-1.06 1.06L11.4 12.8l-1.06-1.06-1.06 1.06.12-.12zM20 4h-3.17L15 2H9L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-5 11.5L14.5 15l-3-3-1.5 1.5-3-3L8.5 9H7v8h10V9h-1.5l-1.5 1.5z"/></svg>
                                {t('take_photo')}
                            </button>
                            <button type="button" onClick={() => fileInputRef.current?.click()}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>
                                {t('upload_document')}
                            </button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,application/pdf" style={{ display: 'none' }} />
                        </div>
                        {filePreview && (
                            <div className="file-preview">
                                {file?.type.startsWith('image/') ? (
                                    <img src={filePreview} alt="Preview" />
                                ) : (
                                    <span className="file-name">{filePreview}</span>
                                )}
                                <button type="button" className="remove-file-button" onClick={removeFile}>&times;</button>
                            </div>
                        )}
                        <button type="submit" className="action-button expense" style={{ marginTop: '20px' }}>{t('add_expense')}</button>
                    </form>
                </div>
            </div>
            <CameraModal isOpen={isCameraOpen} onClose={closeCamera} onCapture={handlePhotoCapture} t={t} />
        </>
    );
};

const IncomeNumpadModal = ({ isOpen, onClose, onSubmit, title, currencySymbol, categories, t }: { isOpen: boolean; onClose: () => void; onSubmit: (data: { amount: number, category: string, documentType?: 'receipt' | 'invoice', clientName?: string, clientEmail?: string, serviceDescription?: string, paymentLink?: string }) => void; title: string; currencySymbol: string; categories?: string[]; t: (key: string) => string; }) => {
    const [inputValue, setInputValue] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories && categories.length > 0 ? categories[0] : 'Other');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [documentType, setDocumentType] = useState<'receipt' | 'invoice' | 'none'>('none');
    const [clientName, setClientName] = useState('');
    const [clientEmail, setClientEmail] = useState('');
    const [serviceDescription, setServiceDescription] = useState('');
    const [paymentLink, setPaymentLink] = useState('');
    const resetState = useCallback(() => { setInputValue(''); if (categories && categories.length > 0) setSelectedCategory(categories[0]); setIsCategoryOpen(false); setDocumentType('none'); setClientName(''); setClientEmail(''); setServiceDescription(''); setPaymentLink(''); }, [categories]);
    useEffect(() => { if (isOpen) resetState(); }, [isOpen, resetState]);
    const handleButtonClick = (value: string) => { if (value === '.' && inputValue.includes('.')) return; setInputValue(inputValue + value); };
    const handleClear = () => setInputValue('');
    const handleEnter = () => { const amount = parseFloat(inputValue); if (!isNaN(amount) && amount > 0) { onSubmit({ amount, category: selectedCategory, documentType: documentType === 'none' ? undefined : documentType, clientName: clientName || undefined, clientEmail: clientEmail || undefined, serviceDescription: serviceDescription || undefined, paymentLink: paymentLink || undefined }); resetState(); } };
    if (!isOpen) return null;
    const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
    return (
      <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true"><div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{title}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <div className="category-selector">
                <button className="category-display-button" onClick={() => setIsCategoryOpen(!isCategoryOpen)}><span>{selectedCategory}</span><span className={`arrow ${isCategoryOpen ? 'up' : 'down'}`}></span></button>
                {isCategoryOpen && <div className="category-dropdown">{categories?.map(cat => (<button key={cat} className="category-dropdown-item" onClick={() => { setSelectedCategory(cat); setIsCategoryOpen(false); }}>{cat}</button>))}</div>}
            </div>
            <div className="numpad-display">{currencySymbol}{inputValue || '0.00'}</div>
            <div className="numpad-grid">{numpadKeys.map(key => <button key={key} className="numpad-button" onClick={() => handleButtonClick(key)}>{key}</button>)}<button onClick={handleClear} className="numpad-button action">{t('clear')}</button></div>
            <div className="numpad-extra-fields">
                <label>{t('generate_document')}</label>
                <div className="doc-type-selector">
                    <button onClick={() => setDocumentType('none')} className={documentType === 'none' ? 'active' : ''}>{t('none')}</button>
                    <button onClick={() => setDocumentType('receipt')} className={documentType === 'receipt' ? 'active' : ''}>{t('receipt')}</button>
                    <button onClick={() => setDocumentType('invoice')} className={documentType === 'invoice' ? 'active' : ''}>{t('invoice')}</button>
                </div>
                {documentType !== 'none' && (<div className="form-field">
                    <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} placeholder={t('client_name')} />
                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder={t('client_email')} />
                    <input type="url" value={paymentLink} onChange={e => setPaymentLink(e.target.value)} placeholder={t('payment_link')} />
                    <textarea value={serviceDescription} onChange={e => setServiceDescription(e.target.value)} placeholder={t('service_description')} rows={2}></textarea>
                </div>)}
            </div>
            <button onClick={handleEnter} className="numpad-enter-button">{t('enter')}</button>
      </div></div>
    );
};

const DocumentViewerModal = ({ transaction, user, currencySymbol, onClose, t }: { transaction: Transaction | null; user: User | null; currencySymbol: string; onClose: () => void; t: (key: string) => string; }) => {
    if (!transaction || !user || !transaction.documentType) return null;
    const vatAmount = user.vatRate > 0 ? (transaction.amount / (1 + user.vatRate / 100)) * (user.vatRate / 100) : 0;
    const subtotal = user.vatRate > 0 ? transaction.amount - vatAmount : transaction.amount;
    const totalAmount = transaction.amount;
    const handlePrint = () => window.print();
    const handleSend = () => { const subject = `${t(transaction.documentType!)} #${transaction.documentNumber}`; const body = `Hello ${transaction.clientName || ''},\n\nPlease find your ${transaction.documentType} attached.\n\nThank you,\n${user.companyName || user.fullName}`; window.location.href = `mailto:${transaction.clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
    return (
        <div className="modal-overlay" onClick={onClose}><div className="modal-content doc-viewer-modal-content" onClick={e => e.stopPropagation()}>
            <div className="doc-viewer-header"><button onClick={onClose} className="close-button">&times;</button></div>
            <div className="doc-viewer-body">
                <header className="doc-header">
                    {user.companyName && user.avatar && <img src={user.avatar} alt="Company Logo" className="company-logo" />}
                    <div><h1>{t(transaction.documentType)}</h1><p>#{transaction.documentNumber}</p></div>
                    <div><h2>{user.companyName || user.fullName}</h2><p>{user.address}</p><p>{user.email}</p><p>{user.phone}</p></div>
                </header>
                <section className="doc-parties">
                    <div className="party-from">
                        <strong>{t('from')}:</strong>
                        <p>{user.companyName || user.fullName}</p>
                        {user.companyRegistrationNumber && <p>{t('company_number')} {user.companyRegistrationNumber}</p>}
                        {user.businessRegistrationCode && <p>{t('vat_number')} {user.businessRegistrationCode}</p>}
                        <p>{user.address}</p>
                        <p>{user.email}</p>
                        <p>{user.phone}</p>
                    </div>
                    <div className="party-to">
                        <strong>{t('to')}:</strong>
                        <p>{transaction.clientName}</p>
                        <p>{transaction.clientEmail}</p>
                    </div>
                </section>
                <div className="doc-details"><strong>{t('date_issued')}:</strong> {new Date(transaction.date).toLocaleDateString()}</div>
                <section className="doc-line-items">
                    <table><thead><tr><th>{t('service_description')}</th><th>{t('total')}</th></tr></thead>
                        <tbody><tr><td>{transaction.serviceDescription}</td><td>{currencySymbol}{totalAmount.toFixed(2)}</td></tr></tbody>
                    </table>
                </section>
                <section className="doc-totals">
                    {user.vatRate > 0 ? (
                        <>
                            <div className="total-row"><span>{t('subtotal')}</span><span>{currencySymbol}{subtotal.toFixed(2)}</span></div>
                            <div className="total-row"><span>{t('vat')} ({user.vatRate}%)</span><span>{currencySymbol}{vatAmount.toFixed(2)}</span></div>
                        </>
                    ) : null}
                    <div className="total-row grand-total"><span>{t('total')}</span><span>{currencySymbol}{totalAmount.toFixed(2)}</span></div>
                </section>
                {(user.bankName || transaction.paymentLink) && (
                    <section className="doc-payment-details">
                        <h4>{t('payment_details')}</h4>
                        {user.bankName && user.accountNumber && (
                            <div className="bank-info">
                                <p><strong>{t('bank_name')}:</strong> {user.bankName}</p>
                                {user.accountHolderName && <p><strong>{t('account_holder_name')}:</strong> {user.accountHolderName}</p>}
                                <p><strong>{t('account_number')}:</strong> {user.accountNumber}</p>
                                {user.sortCode && <p><strong>{t('sort_code')}:</strong> {user.sortCode}</p>}
                                {user.iban && <p><strong>{t('iban')}:</strong> {user.iban}</p>}
                            </div>
                        )}
                        {transaction.paymentLink && (
                           <a href={transaction.paymentLink} target="_blank" rel="noopener noreferrer" className="action-button pay-now-button">{t('pay_now')}</a>
                        )}
                    </section>
                )}
                <footer className="doc-footer"><p>{transaction.documentType === 'invoice' ? t('thank_you') : t('payment_received')}</p></footer>
            </div>
            <div className="doc-viewer-actions"><button className="action-button" onClick={handlePrint}>{t('print')}</button>{transaction.clientEmail && <button className="action-button" onClick={handleSend}>{t('send')}</button>}</div>
        </div></div>
    );
};

const EditTransactionModal = ({ isOpen, onClose, onSubmit, transaction, t }: { isOpen: boolean; onClose: () => void; onSubmit: (data: Transaction) => void; transaction: Transaction | null; t: (key: string) => string; }) => {
    const [formData, setFormData] = useState<Transaction | null>(transaction);
    useEffect(() => { setFormData(transaction); }, [transaction]);
    if (!isOpen || !formData) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number' || name === 'amount';
        setFormData(prev => prev ? { ...prev, [name]: isNumber ? parseFloat(value) || 0 : value } : null);
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (formData) onSubmit(formData); };
    
    const categories = formData.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    return (
        <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('edit_transaction')}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <form onSubmit={handleSubmit} className="edit-transaction-form">
                <div className="form-field"><label htmlFor="edit-amount">{t('amount')}</label><input id="edit-amount" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} required /></div>
                <div className="form-field"><label htmlFor="edit-category">{t('category')}</label><select id="edit-category" name="category" value={formData.category} onChange={handleChange}>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                <div className="form-field"><label htmlFor="edit-date">{t('date')}</label><input id="edit-date" name="date" type="datetime-local" value={new Date(new Date(formData.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().substring(0, 16)} onChange={e => setFormData({...formData, date: new Date(e.target.value).toISOString()})} required /></div>
                {formData.type === 'income' && (
                    <><h4 className="form-section-header">{t('document_details')}</h4>
                       <div className="form-field"><label htmlFor="edit-clientName">{t('client_name')}</label><input id="edit-clientName" name="clientName" type="text" value={formData.clientName || ''} onChange={handleChange} /></div>
                       <div className="form-field"><label htmlFor="edit-clientEmail">{t('client_email')}</label><input id="edit-clientEmail" name="clientEmail" type="email" value={formData.clientEmail || ''} onChange={handleChange} /></div>
                       <div className="form-field"><label htmlFor="edit-paymentLink">{t('payment_link')}</label><input id="edit-paymentLink" name="paymentLink" type="url" value={formData.paymentLink || ''} onChange={handleChange} /></div>
                       <div className="form-field"><label htmlFor="edit-serviceDescription">{t('service_description')}</label><textarea id="edit-serviceDescription" name="serviceDescription" value={formData.serviceDescription || ''} onChange={handleChange} rows={3}></textarea></div>
                    </>
                )}
                <button type="submit" className="action-button">{t('update')}</button>
            </form>
        </div></div>
    );
};

const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"/></svg>;
const AttachmentIcon = () => <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>;
const DetailHeader = ({ title, onBack, t }: { title: string; onBack: () => void; t: (key: string) => string}) => (<div className="detail-header"><button onClick={onBack} className="back-button">&larr; {t('back')}</button><h2>{title}</h2></div>);
const TransactionListItem: React.FC<{ transaction: Transaction; currencySymbol: string; onDocClick: (tx: Transaction) => void; onEditClick: (tx: Transaction) => void; t: (key: string) => string; }> = ({ transaction, currencySymbol, onDocClick, onEditClick, t }) => (
    <li className="transaction-item">
        <div className="transaction-details">
            <span className="transaction-date">{new Date(transaction.date).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <div className="transaction-meta">
                <span className="transaction-category">{transaction.category}</span>
                {transaction.documentType && <button onClick={() => onDocClick(transaction)} className="document-badge">{t(transaction.documentType)} #{transaction.documentNumber}</button>}
                {transaction.attachmentUrl && (
                    <a href={transaction.attachmentUrl} target="_blank" rel="noopener noreferrer" className="attachment-link" aria-label="View Attachment">
                        <AttachmentIcon />
                    </a>
                )}
            </div>
        </div>
        <div className="transaction-right-panel">
            <span className={`amount ${transaction.type}`}>{transaction.type === 'income' ? '+' : '-'}{currencySymbol}{transaction.amount.toFixed(2)}</span>
            <button onClick={() => onEditClick(transaction)} className="edit-button" aria-label={t('edit')}><EditIcon /></button>
        </div>
    </li>
);

const DailyDetailPage = ({ transactions, type, onBack, currencySymbol, onDocClick, onEditClick, t }: { transactions: Transaction[]; type: 'income' | 'expense'; onBack: () => void; currencySymbol: string; onDocClick: (tx: Transaction) => void; onEditClick: (tx: Transaction) => void; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const title = t('todays_type', { type: t(type) });
    return ( <div className="page-content"><DetailHeader title={title} onBack={onBack} t={t} /><ul className="transaction-list">{transactions.length > 0 ? (transactions.map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />)) : <p>{t('no_transactions_today')}</p>}</ul></div> );
};
const WeeklyDetailPage = ({ transactions, type, onBack, currencySymbol, onDocClick, onEditClick, t }: { transactions: Transaction[]; type: 'income' | 'expense'; onBack: () => void; currencySymbol: string; onDocClick: (tx: Transaction) => void; onEditClick: (tx: Transaction) => void; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const title = t('this_weeks_type', { type: t(type) });
    const groupedByDay = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => { const day = new Date(tx.date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); if (!acc[day]) acc[day] = []; acc[day].push(tx); return acc; }, {});
    return ( <div className="page-content"><DetailHeader title={title} onBack={onBack} t={t} />{Object.keys(groupedByDay).length > 0 ? (Object.entries(groupedByDay).map(([day, txs]) => (<div key={day}><h3 className="list-group-header">{day}</h3><ul className="transaction-list">{(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />)}</ul></div>))) : <p>{t('no_transactions_week')}</p>}</div> );
};
const MonthlyDetailPage = ({ transactions, type, onBack, onViewHistory, currencySymbol, onDocClick, onEditClick, t }: { transactions: Transaction[]; type: 'income' | 'expense'; onBack: () => void; onViewHistory: () => void; currencySymbol: string; onDocClick: (tx: Transaction) => void; onEditClick: (tx: Transaction) => void; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const title = t('this_months_type', { type: t(type) });
    const groupedByWeek = transactions.reduce((acc: { [key: string]: Transaction[] }, tx) => { const week = `${t('week')} ${dateUtils.getWeekOfMonth(new Date(tx.date))}`; if (!acc[week]) acc[week] = []; acc[week].push(tx); return acc; }, {});
    return ( <div className="page-content"><DetailHeader title={title} onBack={onBack} t={t} /><button className="action-button" onClick={onViewHistory}>{t('view_history')}</button>{Object.keys(groupedByWeek).length > 0 ? (Object.entries(groupedByWeek).map(([week, txs]) => (<div key={week}><h3 className="list-group-header">{week}</h3><ul className="transaction-list">{(txs as Transaction[]).map(tx => <TransactionListItem key={tx.id} transaction={tx} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />)}</ul></div>))) : <p>{t('no_transactions_month')}</p>}</div> );
};

const HistoryPage = ({ transactions, type, onBack, currencySymbol, t }: { transactions: Transaction[]; type: 'income' | 'expense'; onBack: () => void; currencySymbol: string; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const title = t('monthly_history', { type: t(type) });
    const monthlyTotals = useMemo(() => {
        const totals: { [key: string]: number } = {}; const now = new Date();
        for (let i = 0; i < 24; i++) { const date = new Date(now.getFullYear(), now.getMonth() - i, 1); const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' }); totals[monthKey] = 0; }
        transactions.forEach(tx => { const date = new Date(tx.date); const monthKey = date.toLocaleString('default', { month: 'long', year: 'numeric' }); if (totals[monthKey] !== undefined) totals[monthKey] += tx.amount; });
        return totals;
    }, [transactions]);
    return ( <div className="page-content"><DetailHeader title={title} onBack={onBack} t={t} /><ul className="history-list">{Object.entries(monthlyTotals).map(([month, total]: [string, number]) => ( <li key={month} className="history-item"><span>{month}</span><span className={`amount ${type}`}>{currencySymbol}{total.toFixed(2)}</span></li>))}</ul></div> );
};
const CategoryBreakdown = ({ title, transactions, totalAmount, currencySymbol, type, t }: { title: string; transactions: Transaction[]; totalAmount: number; currencySymbol: string; type: 'income' | 'expense'; t: (key: string) => string; }) => {
    const breakdown = useMemo(() => { if (totalAmount === 0) return []; const grouped = transactions.reduce((acc, tx) => { if (tx.type === type) { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; } return acc; }, {} as Record<string, number>); return Object.entries(grouped).map(([category, amount]) => ({ category, amount, percentage: (amount / totalAmount) * 100, })).sort((a, b) => b.amount - a.amount); }, [transactions, totalAmount, type]);
    return ( <div className="category-breakdown-container"><h3>{title}</h3>{breakdown.length > 0 ? ( <ul className="category-list">{breakdown.map(({ category, amount, percentage }) => ( <li key={category} className="category-item"><div className="category-info"><span className="category-name">{category}</span><span className={`category-amount amount ${type}`}>{currencySymbol}{amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className={`progress-bar ${type}`} style={{ width: `${percentage}%` }} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}></div></div><span className="category-percentage">{percentage.toFixed(1)}%</span></li>))}</ul>) : <p>{t('no_transactions_period')}</p>}</div> );
};

const AuthPage = ({ onLogin }: { onLogin: () => void }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(null); setSuccessMsg(null);
        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onLogin();
            } else {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setSuccessMsg('Signup successful! Check your email.');
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2 className="auth-title">{isLogin ? 'Login' : 'Sign Up'}</h2>
                {error && <p className="auth-error">{error}</p>}
                {successMsg && <p className="auth-success">{successMsg}</p>}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-field"><label>Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
                    <div className="form-field"><label>Password</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></div>
                    <button type="submit" className="action-button auth-submit">{isLogin ? 'Login' : 'Sign Up'}</button>
                </form>
                <button className="auth-toggle" onClick={() => setIsLogin(!isLogin)}>
                    {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Login"}
                </button>
            </div>
        </div>
    );
};

const MainPage = ({ income, expenses, onNavClick, currencySymbol, currentPeriod, onPeriodChange, locale, t }: any) => {
  const balance = (income - expenses).toFixed(2);
  return (
    <div className="page-content">
      <CurrentDateTime locale={locale} />
      <h2>{t('dashboard')}</h2>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onNavClick('income')}>
          <div className="card-label"><h3>{t('income')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled expense clickable" onClick={() => onNavClick('expense')}>
          <div className="card-label"><h3>{t('expense')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div>
        </div>
        <div className="income-card-styled balance">
          <div className="card-label"><h3>{t('balance')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{balance}</p></div>
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

const IncomePage = ({ income, weeklyIncome, monthlyIncome, addIncome, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: any) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions;
  const currentTotal = period === 'daily' ? income : period === 'weekly' ? weeklyIncome : monthlyIncome;
  const title = t('income_breakdown', { period: t(period) });
  const handleAddIncome = useCallback((data: any) => { addIncome(data); setIsModalOpen(false); }, [addIncome]);
  
  return (
    <div className="page-content">
      <CurrentDateTime locale={locale} />
      <h2>{t('income')}</h2>
      <button className="action-button" onClick={() => setIsModalOpen(true)}>{t('add_income')}</button>
      <div className="cards-list">
        <div className="income-card-styled income clickable" onClick={() => onCardClick('daily')}><div className="card-label"><h3>{t('daily')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('weekly')}><div className="card-label"><h3>{t('weekly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{weeklyIncome.toFixed(2)}</p></div></div>
        <div className="income-card-styled income clickable" onClick={() => onCardClick('monthly')}><div className="card-label"><h3>{t('monthly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{monthlyIncome.toFixed(2)}</p></div></div>
      </div>
      <CategoryBreakdown title={title} transactions={currentTransactions} totalAmount={currentTotal} currencySymbol={currencySymbol} type="income" t={t} />
      <div className="period-selector">
        <button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button>
        <button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button>
        <button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button>
      </div>
      <IncomeNumpadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddIncome} title={t('add_income')} currencySymbol={currencySymbol} categories={INCOME_CATEGORIES} t={t} />
    </div>
  );
};

const ExpensePage = ({ expenses, weeklyExpenses, monthlyExpenses, addExpense, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: any) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
    const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions;
    const currentTotal = period === 'daily' ? expenses : period === 'weekly' ? weeklyExpenses : monthlyExpenses;
    const title = t('expense_breakdown', { period: t(period) });
    const handleAddExpense = useCallback((data: any) => { addExpense(data); setIsModalOpen(false); }, [addExpense]);

    return (
      <div className="page-content">
        <CurrentDateTime locale={locale} />
        <h2>{t('expense')}</h2>
        <button className="action-button expense" onClick={() => setIsModalOpen(true)}>{t('add_expense')}</button>
         <div className="cards-list">
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('daily')}><div className="card-label"><h3>{t('daily')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('weekly')}><div className="card-label"><h3>{t('weekly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{weeklyExpenses.toFixed(2)}</p></div></div>
          <div className="income-card-styled expense clickable" onClick={() => onCardClick('monthly')}><div className="card-label"><h3>{t('monthly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{monthlyExpenses.toFixed(2)}</p></div></div>
        </div>
        <CategoryBreakdown title={title} transactions={currentTransactions} totalAmount={currentTotal} currencySymbol={currencySymbol} type="expense" t={t} />
        <div className="period-selector">
            <button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button>
            <button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button>
            <button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button>
        </div>
        <ExpenseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddExpense} title={t('add_expense')} currencySymbol={currencySymbol} categories={EXPENSE_CATEGORIES} t={t} />
      </div>
    );
};

const ProfilePage = ({ user, onUpdate, t }: { user: User | null; onUpdate: (u: User) => void; t: (key: string) => string }) => {
    const [formData, setFormData] = useState<User | null>(user);
    useEffect(() => { setFormData(user); }, [user]);
    if (!formData) return null;
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => prev ? { ...prev, [name]: value } : null);
    };
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (formData) onUpdate(formData); };
    return (
        <div className="page-content">
            <h2>{t('profile')}</h2>
            <form onSubmit={handleSubmit} className="profile-form">
                <div className="profile-avatar-section">
                   {formData.avatar ? <img src={formData.avatar} alt="Profile" className="profile-avatar-preview" /> : <div className="profile-avatar-preview" style={{background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{formData.fullName?.charAt(0) || formData.email?.charAt(0)}</div>}
                   <button type="button" className="action-button" style={{width: 'auto', fontSize: '0.9rem', padding: '8px 16px'}} onClick={() => alert("Avatar upload coming soon!")}>{t('upload_avatar')}</button>
                </div>
                <div className="form-field"><label htmlFor="fullName">{t('full_name')}</label><input id="fullName" name="fullName" value={formData.fullName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="email">{t('email_address')}</label><input id="email" value={formData.email} disabled /></div>
                <div className="form-field"><label htmlFor="phone">{t('phone_number')}</label><input id="phone" name="phone" value={formData.phone} onChange={handleChange} /></div>
                <h3 className="profile-form-section-header">{t('company_name')}</h3>
                <div className="form-field"><label htmlFor="companyName">{t('company_name')}</label><input id="companyName" name="companyName" value={formData.companyName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="businessRegistrationCode">{t('business_reg_code')}</label><input id="businessRegistrationCode" name="businessRegistrationCode" value={formData.businessRegistrationCode} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="companyRegistrationNumber">{t('company_reg_number')}</label><input id="companyRegistrationNumber" name="companyRegistrationNumber" value={formData.companyRegistrationNumber} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="address">{t('address')}</label><input id="address" name="address" value={formData.address} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="vatRate">{t('vat_rate')} (%)</label><input id="vatRate" name="vatRate" type="number" value={formData.vatRate} onChange={handleChange} /></div>
                <h3 className="profile-form-section-header">{t('bank_details')}</h3>
                <div className="form-field"><label htmlFor="bankName">{t('bank_name')}</label><input id="bankName" name="bankName" value={formData.bankName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="accountHolderName">{t('account_holder_name')}</label><input id="accountHolderName" name="accountHolderName" value={formData.accountHolderName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="accountNumber">{t('account_number')}</label><input id="accountNumber" name="accountNumber" value={formData.accountNumber} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="sortCode">{t('sort_code')}</label><input id="sortCode" name="sortCode" value={formData.sortCode} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="iban">{t('iban')}</label><input id="iban" name="iban" value={formData.iban} onChange={handleChange} /></div>
                <button type="submit" className="action-button">{t('update_profile')}</button>
            </form>
        </div>
    );
};

const SettingsPage = ({ theme, onThemeChange, currency, onCurrencyChange, fontSize, onFontSizeChange, language, onLanguageChange, onLogout, t }: any) => (
    <div className="page-content">
      <h2>{t('settings')}</h2>
      <div className="settings-group"><h3>{t('appearance')}</h3><div className="theme-selector"><button onClick={() => onThemeChange('light')} className={theme === 'light' ? 'active' : ''}>{t('light')}</button><button onClick={() => onThemeChange('dark')} className={theme === 'dark' ? 'active' : ''}>{t('dark')}</button><button onClick={() => onThemeChange('auto')} className={theme === 'auto' ? 'active' : ''}>{t('auto')}</button></div></div>
      <div className="settings-group"><h3>{t('font_size')}</h3><div className="theme-selector"><button onClick={() => onFontSizeChange('small')} className={fontSize === 'small' ? 'active' : ''}>{t('small')}</button><button onClick={() => onFontSizeChange('medium')} className={fontSize === 'medium' ? 'active' : ''}>{t('medium')}</button><button onClick={() => onFontSizeChange('large')} className={fontSize === 'large' ? 'active' : ''}>{t('large')}</button></div></div>
      <div className="settings-group"><h3>{t('currency')}</h3><select className="currency-selector" value={currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)}>{Object.entries(currencyMap).map(([code, symbol]) => (<option key={code} value={code}>{code} ({symbol})</option>))}</select></div>
      <div className="settings-group"><h3>Language</h3><select className="currency-selector" value={language} onChange={(e) => onLanguageChange(e.target.value as Language)}><option value="en">English</option><option value="ro">Română</option></select></div>
      <button className="action-button expense" onClick={onLogout}>{t('logout')}</button>
    </div>
);

const TaxPage = ({ transactions, currencySymbol, t }: any) => {
    const [startDate, setStartDate] = useState<Date | null>(null); const [endDate, setEndDate] = useState<Date | null>(null); const [isCalendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null); const [reportReady, setReportReady] = useState(false);
    const reportData = useMemo(() => {
        if (!startDate || !endDate || endDate < startDate) return null;
        const start = new Date(startDate); start.setHours(0, 0, 0, 0); 
        const end = new Date(endDate); end.setHours(23, 59, 59, 999);
        const filtered = transactions.filter((tx: Transaction) => { const txDate = new Date(tx.date); return txDate >= start && txDate <= end; });
        const totals = filtered.reduce((acc: any, tx: Transaction) => { if (tx.type === 'income') acc.income += tx.amount; else acc.expense += tx.amount; return acc; }, { income: 0, expense: 0 });
        return { transactions: filtered, totalIncome: totals.income, totalExpense: totals.expense, balance: totals.income - totals.expense, };
    }, [transactions, startDate, endDate]);
    const generateCSV = () => {
        if (!reportData) return; setReportReady(false);
        let csvContent = "Date,Type,Amount,Category\n";
        reportData.transactions.forEach((tx: Transaction) => { csvContent += `${new Date(tx.date).toLocaleString()},${tx.type},${tx.amount.toFixed(2)},${tx.category}\n`; });
        csvContent += `\n${t('total_income')},${reportData.totalIncome.toFixed(2)}\n${t('total_expense')},${reportData.totalExpense.toFixed(2)}\n${t('balance')},${reportData.balance.toFixed(2)}\n`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.setAttribute("href", url); const dateString = `${startDate!.toISOString().split('T')[0]}_to_${endDate!.toISOString().split('T')[0]}`; link.setAttribute("download", `tax-report-${dateString}.csv`); document.body.appendChild(link); link.click(); document.body.removeChild(link); setReportReady(true);
    };
    const sendEmail = () => { const subject = t('tax_report'); const body = `Hello,\n\nPlease find my tax report attached for the period from ${startDate!.toLocaleDateString()} to ${endDate!.toLocaleDateString()}.\n\nThank you.`; window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
    return (
        <div className="page-content"><h2>{t('tax_report')}</h2><p className="page-subtitle">{t('tax_subtitle')}</p>
            <div className="date-selector-container"><div className="date-selector" onClick={() => setCalendarOpen('start')}><label>{t('start_date')}</label><span>{startDate ? startDate.toLocaleDateString() : t('select_date')}</span></div><div className="date-selector" onClick={() => setCalendarOpen('end')}><label>{t('end_date')}</label><span>{endDate ? endDate.toLocaleDateString() : t('select_date')}</span></div></div>
            {reportData && (<div className="report-summary"><h3>{t('report_summary')}</h3><div className="summary-item"><span>{t('total_income')}</span><span className="amount income">{currencySymbol}{reportData.totalIncome.toFixed(2)}</span></div><div className="summary-item"><span>{t('total_expense')}</span><span className="amount expense">{currencySymbol}{reportData.totalExpense.toFixed(2)}</span></div><div className="summary-item"><span>{t('balance')}</span><span className="amount balance">{currencySymbol}{reportData.balance.toFixed(2)}</span></div>{!reportReady ? <button className="action-button" onClick={generateCSV}>{t('download_csv')}</button> : <button className="action-button income" onClick={sendEmail}>{t('send_email')}</button>}</div>)}
            <CalendarModal isOpen={!!isCalendarOpen} onClose={() => setCalendarOpen(null)} onSelectDate={date => { if (isCalendarOpen === 'start') setStartDate(date); if (isCalendarOpen === 'end') setEndDate(date); }} />
        </div>
    );
};

const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const IncomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M13 19V7.83l4.59 4.58L19 11l-7-7-7 7 1.41 1.41L11 7.83V19h2z"/></svg>;
const ExpenseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M11 5v11.17l-4.59-4.58L5 13l7 7 7-7-1.41-1.41L13 16.17V5h-2z"/></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.22-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>;
const TaxIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2H9v-2H7v-2h2V9h2v2h2v2zm4-6V3.5L18.5 9H13z"/></svg>;
const Footer = ({ currentPage, onNavClick, t }: any) => {
  const navItems = [ { page: 'main', label: t('home'), icon: <HomeIcon /> }, { page: 'income', label: t('income'), icon: <IncomeIcon /> }, { page: 'expense', label: t('expense'), icon: <ExpenseIcon /> }, { page: 'tax', label: t('tax'), icon: <TaxIcon /> }, { page: 'settings', label: t('settings'), icon: <SettingsIcon /> }, ];
  return ( <footer className="app-footer"><nav>{navItems.map(item => ( <button key={item.page} className={currentPage === item.page ? 'active' : ''} onClick={() => onNavClick(item.page)} aria-label={`Go to ${item.label} page`}>{item.icon}<span>{item.label}</span></button>))}</nav></footer> );
};

// --- App Component ---

function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<AppView>({ page: 'main' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'auto');
  const [fontSize, setFontSize] = useState<FontSize>(() => (localStorage.getItem('fontSize') as FontSize) || 'medium');
  const [currency, setCurrency] = useState<Currency>(() => (localStorage.getItem('currency') as Currency) || 'GBP');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'en');
  const [mainViewPeriod, setMainViewPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const t = useCallback((key: string, replacements?: Record<string, string>) => {
      let text = translations[key]?.[language] || key;
      if (replacements) {
          Object.entries(replacements).forEach(([k, v]) => {
              text = text.replace(`{${k}}`, v);
          });
      }
      return text;
  }, [language]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (!supabase) {
          if (mounted) setIsInitializing(false);
          return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
            setSession(session);
            if (session) await fetchUserData(session.user.id);
        }
      } catch (error) {
        console.error("Auth init error", error);
      } finally {
        if (mounted) setIsInitializing(false);
      }
    };

    initAuth();

    if (supabase) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            if (mounted) {
                setSession(session);
                if (session) {
                    fetchUserData(session.user.id); 
                } else {
                    setUser(null);
                    setTransactions([]);
                }
            }
        });
        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    } else {
        mounted = false;
    }
  }, []);

  const fetchUserData = async (userId: string) => {
      setLoading(true);
      try {
          let { data: profile, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
          if (error && error.code === 'PGRST116') {
               const { data: newProfile, error: createError } = await supabase.from('profiles').insert([{ id: userId }]).select().single();
               if (createError) throw createError;
               profile = newProfile;
          } else if (error) throw error;
          
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser && profile) setUser(dbProfileToApp(profile, authUser));
          await fetchTransactions();
      } catch (err: any) {
          console.error('Error fetching user data:', err);
      } finally { setLoading(false); }
  };

  const fetchTransactions = async () => {
      const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      if (error) console.error('Error fetching transactions:', error);
      else if (data) setTransactions(data.map(dbTransactionToApp));
  };

  const addTransaction = async (data: { 
      amount: number; 
      category: string; 
      type: 'income' | 'expense';
      file?: File; 
      bucket?: string; 
      description?: string; 
      serviceDescription?: string; 
  }) => {
      if (!session?.user) return;
      setLoading(true);
      try {
          let attachmentUrl = null;
          if (data.file && data.bucket) {
              const fileExt = data.file.name.split('.').pop();
              const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;
              const { error: uploadError } = await supabase.storage
                  .from(data.bucket)
                  .upload(fileName, data.file);
              
              if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
              
              const { data: urlData } = supabase.storage.from(data.bucket).getPublicUrl(fileName);
              attachmentUrl = urlData.publicUrl;
          }

          const tempTx: Partial<Transaction> = {
              userId: session.user.id,
              date: new Date().toISOString(),
              type: data.type,
              amount: data.amount,
              category: data.category,
              serviceDescription: data.serviceDescription || data.description,
              documentType: (data as any).documentType,
              documentNumber: (data as any).documentNumber, 
              clientName: (data as any).clientName,
              clientEmail: (data as any).clientEmail,
              paymentLink: (data as any).paymentLink,
              attachmentUrl: attachmentUrl || undefined,
              attachmentBucket: data.bucket || undefined 
          };

          const dbDataRaw = mapTransactionToDb(tempTx);
          
          const { error } = await supabase.from('transactions').insert([dbDataRaw]);
          if (error) throw error;
          
          await fetchTransactions();
      } catch (error: any) {
          console.error("Add Transaction Error:", error);
          alert(`Error saving transaction: ${error.message}`);
      } finally {
          setLoading(false);
      }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
      setLoading(true);
      try {
          const dbDataRaw = mapTransactionToDb(updatedTx);
          const { error } = await supabase.from('transactions').update(dbDataRaw).eq('id', updatedTx.id);
          if (error) throw error;
          await fetchTransactions();
      } catch (error: any) { alert(`Error updating: ${error.message}`); } finally { setLoading(false); }
  };

  const updateUser = async (updatedUser: User) => {
      setLoading(true);
      try {
          const dbProfile = appUserToDbProfile(updatedUser);
          const { error } = await supabase.from('profiles').update({ ...dbProfile, updated_at: new Date().toISOString() }).eq('id', updatedUser.id);
          if (error) throw error;
          setUser(updatedUser);
          alert('Profile updated successfully');
      } catch (error: any) { alert(`Error updating profile: ${error.message}`); } finally { setLoading(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); setSession(null); setUser(null); };

  useEffect(() => { localStorage.setItem('theme', theme); document.body.className = theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark-theme' : '') : (theme === 'dark' ? 'dark-theme' : ''); }, [theme]);
  useEffect(() => { localStorage.setItem('fontSize', fontSize); document.documentElement.style.fontSize = { small: '14px', medium: '16px', large: '18px' }[fontSize]; }, [fontSize]);
  useEffect(() => { localStorage.setItem('currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('language', language); }, [language]);

  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);
  const locale = useMemo(() => languageToLocaleMap[language], [language]);

  const { dailyIncome, weeklyIncome, monthlyIncome, dailyExpenses, weeklyExpenses, monthlyExpenses, dailyTransactions, weeklyTransactions, monthlyTransactions } = useMemo(() => {
    const totals = { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0 };
    const lists = { dailyTransactions: [] as Transaction[], weeklyTransactions: [] as Transaction[], monthlyTransactions: [] as Transaction[] };
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      if (dateUtils.isToday(date)) { lists.dailyTransactions.push(tx); if (tx.type === 'income') totals.dailyIncome += tx.amount; else totals.dailyExpenses += tx.amount; }
      if (dateUtils.isThisWeek(date)) { lists.weeklyTransactions.push(tx); if (tx.type === 'income') totals.weeklyIncome += tx.amount; else totals.weeklyExpenses += tx.amount; }
      if (dateUtils.isThisMonth(date)) { lists.monthlyTransactions.push(tx); if (tx.type === 'income') totals.monthlyIncome += tx.amount; else totals.monthlyExpenses += tx.amount; }
    });
    return {...totals, ...lists};
  }, [transactions]);

  if (supabaseError) {
      return (
          <div className="app-container" style={{justifyContent: 'center', alignItems: 'center', padding: '20px', textAlign: 'center'}}>
              <div className="error-box">
                  <h3>Configuration Error</h3>
                  <p className="error-message">{supabaseError}</p>
              </div>
          </div>
      );
  }

  if (isInitializing) {
    return <div className="app-container"><div className="loading-spinner"></div></div>;
  }

  if (!session) return <AuthPage onLogin={() => {}} />;

  const renderPage = () => {
    const { page, period, transactionType } = view;
    if (page === 'profile') return <ProfilePage user={user} onUpdate={updateUser} t={t} />;
    if (page === 'history') { const allTypeTransactions = transactions.filter(tx => tx.type === transactionType); return <HistoryPage transactions={allTypeTransactions} type={transactionType!} onBack={() => setView({ page: 'detail', transactionType, period: 'monthly' })} currencySymbol={currencySymbol} t={t} />; }
    if (page === 'detail') {
      const filters = { daily: dateUtils.isToday, weekly: dateUtils.isThisWeek, monthly: dateUtils.isThisMonth, };
      const relevantTransactions = transactions.filter(tx => tx.type === transactionType && filters[period!](new Date(tx.date)));
      const onBack = () => setView({ page: transactionType! });
      const commonProps = { transactions: relevantTransactions, type: transactionType!, onBack, currencySymbol, onDocClick: (tx: Transaction) => setDocViewerTx(tx), onEditClick: (tx: Transaction) => setEditTx(tx), t };
      switch (period) {
        case 'daily': return <DailyDetailPage {...commonProps} />;
        case 'weekly': return <WeeklyDetailPage {...commonProps} />;
        case 'monthly': return <MonthlyDetailPage {...commonProps} onViewHistory={() => setView({ page: 'history', transactionType })} />;
        default: return null;
      }
    }
    switch (page) {
      case 'income': return <IncomePage income={dailyIncome} weeklyIncome={weeklyIncome} monthlyIncome={monthlyIncome} addIncome={(data: any) => addTransaction({ ...data, type: 'income' })} onCardClick={(p: any) => setView({ page: 'detail', transactionType: 'income', period: p })} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
      case 'expense': return <ExpensePage expenses={dailyExpenses} weeklyExpenses={weeklyExpenses} monthlyExpenses={monthlyExpenses} addExpense={(data: any) => addTransaction({ ...data, type: 'expense' })} onCardClick={(p: any) => setView({ page: 'detail', transactionType: 'expense', period: p })} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
      case 'settings': return <SettingsPage theme={theme} onThemeChange={setTheme} currency={currency} onCurrencyChange={setCurrency} fontSize={fontSize} onFontSizeChange={setFontSize} language={language} onLanguageChange={setLanguage} onLogout={handleLogout} t={t} />;
      case 'tax': return <TaxPage transactions={transactions} currencySymbol={currencySymbol} t={t} />;
      case 'main': default: return <MainPage income={mainViewPeriod === 'weekly' ? weeklyIncome : (mainViewPeriod === 'monthly' ? monthlyIncome : dailyIncome)} expenses={mainViewPeriod === 'weekly' ? weeklyExpenses : (mainViewPeriod === 'monthly' ? monthlyExpenses : dailyExpenses)} onNavClick={(p: any) => setView({ page: p })} currencySymbol={currencySymbol} currentPeriod={mainViewPeriod} onPeriodChange={setMainViewPeriod} locale={locale} t={t} />;
    }
  };

  const [docViewerTx, setDocViewerTx] = useState<Transaction | null>(null);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  return (
    <div className="app-container">
      {loading && <div className="loading-spinner"></div>}
      <header className="app-header">
         <div className="header-content"><h1>Account Assistant</h1><p className="slogan">{t('slogan')}</p></div>
         <div className="header-controls">
             <div className="language-selector-wrapper">
                 <select className="language-selector" value={language} onChange={e => setLanguage(e.target.value as Language)}><option value="en">EN</option><option value="ro">RO</option></select>
                 <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
             </div>
             {user && (<button className="profile-button" onClick={() => setView({ page: 'profile' })}>{user.avatar ? <img src={user.avatar} alt="Profile" className="profile-avatar-icon" /> : <div className="profile-initials-icon">{user.fullName?.charAt(0)}</div>}</button>)}
         </div>
      </header>
      <main ref={mainRef}>{renderPage()}</main>
      <Footer currentPage={view.page} onNavClick={(p: any) => setView({ page: p })} t={t} />
      {docViewerTx && <DocumentViewerModal transaction={docViewerTx} user={user} currencySymbol={currencySymbol} onClose={() => setDocViewerTx(null)} t={t} />}
      {editTx && <EditTransactionModal isOpen={!!editTx} transaction={editTx} onClose={() => setEditTx(null)} onSubmit={(tx) => { updateTransaction(tx); setEditTx(null); }} t={t} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
);