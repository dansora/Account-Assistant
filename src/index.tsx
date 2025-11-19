import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { createClient, Session, User as SupabaseUser } from '@supabase/supabase-js';
import './index.css';

// --- Supabase Client ---
// Fix: Accessing `import.meta.env` without resolved Vite client types. Casting to `any` as a workaround.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// Fix: Accessing `import.meta.env` without resolved Vite client types. Casting to `any` as a workaround.
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;padding:15px;background-color:#e74c3c;color:white;text-align:center;font-family:sans-serif;z-index:9999;';
    errorDiv.innerText = 'Supabase URL and Anon Key are not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.';
    document.body.prepend(errorDiv);
}
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Type Definitions ---
type DbTransaction = {
  id: number; user_id: string; created_at: string; date: string; type: 'income' | 'expense'; amount: number;
  category: string; document_type: 'receipt' | 'invoice' | null; document_number: string | null; client_name: string | null;
  client_email: string | null; service_description: string | null; attachment_url: string | null;
};
type DbProfile = {
  id: string; updated_at: string | null; full_name: string | null; username: string | null; phone: string | null;
  avatar: string | null; company_name: string | null; business_registration_code: string | null; address: string | null; vat_rate: number;
  company_registration_number: string | null; bank_name: string | null; account_holder_name: string | null; account_number: string | null;
  sort_code: string | null; iban_code: string | null;
};

type Transaction = {
  id: number; userId: string; createdAt: string; date: string; type: 'income' | 'expense'; amount: number; category: string;
  documentType?: 'receipt' | 'invoice'; documentNumber?: string; clientName?: string; clientEmail?: string; serviceDescription?: string; paymentLink?: string;
  attachmentUrl?: string;
};
type User = {
    id: string; updatedAt?: string; fullName: string; username: string; email: string; phone: string; avatar: string;
    companyName: string; businessRegistrationCode: string; address: string; vatRate: number;
    companyRegistrationNumber: string; bankName: string; accountHolderName: string; accountNumber: string; sortCode: string; iban: string;
};

type AppView = { page: 'main' | 'income' | 'expense' | 'settings' | 'detail' | 'history' | 'tax' | 'profile'; period?: 'daily' | 'weekly' | 'monthly'; transactionType?: 'income' | 'expense'; };
type Theme = 'light' | 'dark' | 'auto'; type FontSize = 'small' | 'medium' | 'large'; type Language = 'en' | 'ro';
type Currency = 'GBP' | 'USD' | 'CAD' | 'AUD' | 'EUR' | 'JPY' | 'CNY' | 'CHF' | 'INR';

// --- Data Mapping ---
const dbTransactionToApp = (dbTx: DbTransaction): Transaction => {
    const paymentLinkMarker = '[PAYMENT_LINK]';
    let serviceDescription = dbTx.service_description || undefined;
    let paymentLink: string | undefined;

    if (serviceDescription && serviceDescription.includes(paymentLinkMarker)) {
        const parts = serviceDescription.split(paymentLinkMarker);
        serviceDescription = parts[0].trim() || undefined; // get the description part
        paymentLink = parts[1] || undefined; // get the URL part
    }

    return {
        id: dbTx.id, userId: dbTx.user_id, createdAt: dbTx.created_at, date: dbTx.date, type: dbTx.type, amount: dbTx.amount, category: dbTx.category,
        documentType: dbTx.document_type || undefined, documentNumber: dbTx.document_number || undefined, clientName: dbTx.client_name || undefined,
        clientEmail: dbTx.client_email || undefined,
        serviceDescription: serviceDescription,
        paymentLink: paymentLink,
        attachmentUrl: dbTx.attachment_url || undefined,
    };
};

const appTransactionToDb = (appTx: Partial<Transaction>): Omit<DbTransaction, 'id' | 'created_at' | 'user_id'> & { user_id?: string } => {
    const paymentLinkMarker = '[PAYMENT_LINK]';
    let serviceDescription = appTx.serviceDescription || '';
    if (appTx.paymentLink) {
        serviceDescription = `${serviceDescription} ${paymentLinkMarker}${appTx.paymentLink}`;
    }

    return {
        user_id: appTx.userId, date: appTx.date!, type: appTx.type!, amount: appTx.amount!, category: appTx.category!,
        document_type: appTx.documentType || null, document_number: appTx.documentNumber || null, client_name: appTx.clientName || null,
        client_email: appTx.clientEmail || null,
        service_description: serviceDescription.trim() || null,
        attachment_url: appTx.attachmentUrl || null,
    };
};

const dbProfileToApp = (dbProfile: DbProfile, authUser: SupabaseUser): User => {
    return {
        id: dbProfile.id,
        updatedAt: dbProfile.updated_at || undefined,
        fullName: dbProfile.full_name || '',
        username: dbProfile.username || '',
        email: authUser.email || '',
        phone: dbProfile.phone || '',
        avatar: dbProfile.avatar || '',
        companyName: dbProfile.company_name || '',
        businessRegistrationCode: dbProfile.business_registration_code || '',
        companyRegistrationNumber: dbProfile.company_registration_number || '',
        address: dbProfile.address || '',
        vatRate: dbProfile.vat_rate || 0,
        bankName: dbProfile.bank_name || '',
        accountHolderName: dbProfile.account_holder_name || '',
        accountNumber: dbProfile.account_number || '',
        sortCode: dbProfile.sort_code || '',
        iban: dbProfile.iban_code || '',
    };
};

const appUserToDbProfile = (appUser: User): Omit<DbProfile, 'id' | 'updated_at'> => {
    return {
        full_name: appUser.fullName || null,
        username: appUser.username || null,
        phone: appUser.phone || null,
        avatar: appUser.avatar || null,
        company_name: appUser.companyName || null,
        business_registration_code: appUser.businessRegistrationCode || null,
        company_registration_number: appUser.companyRegistrationNumber || null,
        address: appUser.address || null,
        vat_rate: appUser.vatRate || 0,
        bank_name: appUser.bankName || null,
        account_holder_name: appUser.accountHolderName || null,
        account_number: appUser.accountNumber || null,
        sort_code: appUser.sortCode || null,
        iban_code: appUser.iban || null,
    };
};


// --- Constants & Utilities ---
const currencyMap: Record<Currency, string> = { 'GBP': '£', 'USD': '$', 'CAD': 'CA$', 'AUD': 'A$', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'CHF': 'Fr', 'INR': '₹', };
const languageToLocaleMap: Record<Language, string> = { 'en': 'en-GB', 'ro': 'ro-RO' };
const translations: Record<string, Record<Language, string>> = {
  income: { en: 'Income', ro: 'Venit' }, expense: { en: 'Expense', ro: 'Cheltuială' }, balance: { en: 'Balance', ro: 'Balanță' },
  daily: { en: 'Daily', ro: 'Zilnic' }, weekly: { en: 'Weekly', ro: 'Săptămânal' }, monthly: { en: 'Monthly', ro: 'Lunar' },
  back: { en: 'Back', ro: 'Înapoi' }, week: { en: 'Week', ro: 'Săptămâna'},
  welcome: { en: 'Welcome to Account Assistant', ro: 'Bun venit la Asistentul Contabil' }, slogan: { en: 'Your Accountancy Assistant for MTD', ro: 'Asistentul tău Contabil pentru MTD' },
  home: { en: 'Home', ro: 'Acasă' }, tax: { en: 'Tax', ro: 'Taxe' }, settings: { en: 'Settings', ro: 'Setări' }, dashboard: { en: 'Dashboard', ro: 'Panou de control' },
  add_income: { en: 'Add Income', ro: 'Adaugă Venit' }, add_expense: { en: 'Add Expense', ro: 'Adaugă Cheltuială' },
  income_breakdown: { en: '{period} Income Breakdown', ro: 'Detalii Venituri {period}' }, expense_breakdown: { en: '{period} Expense Breakdown', ro: 'Detalii Cheltuieli {period}' },
  add_entry: { en: 'Add Entry', ro: 'Adaugă Înregistrare' }, clear: { en: 'Clear', ro: 'Șterge' }, enter: { en: 'Enter', ro: 'Introdu' },
  todays_type: { en: 'Today\'s {type}', ro: '{type} de Azi' }, no_transactions_today: { en: 'No transactions for today.', ro: 'Nicio tranzacție azi.' },
  this_weeks_type: { en: 'This Week\'s {type}', ro: '{type} Săptămâna Aceasta' }, no_transactions_week: { en: 'No transactions for this week.', ro: 'Nicio tranzacție săptămâna aceasta.' },
  this_months_type: { en: 'This Month\'s {type}', ro: '{type} Luna Aceasta' }, view_history: { en: 'View History', ro: 'Vezi Istoric' },
  no_transactions_month: { en: 'No transactions for this month.', ro: 'Nicio tranzacție luna aceasta.' }, monthly_history: { en: 'Monthly {type} History', ro: 'Istoric Lunar {type}' },
  no_transactions_period: { en: 'No transactions for this period.', ro: 'Nicio tranzacție pentru această perioadă.'},
  appearance: { en: 'Appearance', ro: 'Aspect' }, light: { en: 'Light', ro: 'Luminos' }, dark: { en: 'Dark', ro: 'Întunecat' }, auto: { en: 'Auto', ro: 'Automat' },
  font_size: { en: 'Font Size', ro: 'Dimensiune Font' }, small: { en: 'Small', ro: 'Mic' }, medium: { en: 'Medium', ro: 'Mediu' }, large: { en: 'Large', ro: 'Mare' },
  currency: { en: 'Currency', ro: 'Monedă' }, contact_us: { en: 'Contact Us', ro: 'Contactează-ne' },
  contact_intro: { en: 'Have a question or feedback? We\'d love to hear from you.', ro: 'Ai o întrebare sau un feedback? Ne-ar plăcea să auzim de la tine.' },
  contact_name: { en: 'Name', ro: 'Nume' }, contact_your_name: { en: 'Your Name', ro: 'Numele tău' }, contact_email: { en: 'Email', ro: 'Email' },
  contact_your_email: { en: 'your@email.com', ro: 'emailul@tau.com' }, contact_phone: { en: 'Phone Number (Optional)', ro: 'Număr de Telefon (Opțional)' },
  contact_your_phone: { en: 'Your Phone Number', ro: 'Numărul tău de telefon' }, contact_message: { en: 'Message', ro: 'Mesaj' },
  contact_enter_message: { en: 'Enter your message here...', ro: 'Introdu mesajul tău aici...' }, send_message: { en: 'Send Message', ro: 'Trimite Mesaj' },
  tax_report: { en: 'Tax Report', ro: 'Raport Fiscal' }, tax_subtitle: { en: 'Select a period to generate your report.', ro: 'Selectează o perioadă pentru a genera raportul.' },
  start_date: { en: 'Start Date', ro: 'Data de început' }, end_date: { en: 'End Date', ro: 'Data de sfârșit' }, select_date: { en: 'Select a date', ro: 'Selectează o dată' },
  report_summary: { en: 'Report Summary', ro: 'Sumar Raport' }, total_income: { en: 'Total Income:', ro: 'Venit Total:' }, total_expense: { en: 'Total Expense:', ro: 'Cheltuieli Totale:' },
  download_csv: { en: 'Download Report (.csv)', ro: 'Descarcă Raport (.csv)' }, send_email: { en: 'Send Email', ro: 'Trimite Email' },
  login: { en: 'Login', ro: 'Autentificare' }, signup: { en: 'Sign Up', ro: 'Înregistrare' }, email_address: { en: 'Email Address', ro: 'Adresă de Email' }, password: { en: 'Password', ro: 'Parolă' },
  full_name: { en: 'Full Name', ro: 'Nume Complet' }, username: { en: 'Username', ro: 'Nume utilizator' },
  no_account: { en: "Don't have an account? Sign Up", ro: 'Nu ai cont? Înregistrează-te' }, has_account: { en: 'Already have an account? Login', ro: 'Ai deja cont? Autentifică-te' },
  logout: { en: 'Logout', ro: 'Deconectare' }, profile: { en: 'Profile', ro: 'Profil' }, phone_number: { en: 'Phone Number', ro: 'Număr de Telefon' },
  profile_picture: { en: 'Profile Picture', ro: 'Poză de Profil' }, update_profile: { en: 'Update Profile', ro: 'Actualizează Profilul' },
  login_failed: { en: 'Invalid login credentials.', ro: 'Credențiale de autentificare invalide.' },
  signup_failed: { en: 'An account with this email already exists.', ro: 'Un cont cu acest email există deja.' },
  signup_generic_error: { en: 'An unexpected error occurred. Please try again.', ro: 'A apărut o eroare neașteptată. Vă rugăm să încercați din nou.' },
  check_email_confirmation: { en: 'Signup successful! Please check your email to confirm your account.', ro: 'Înregistrare reușită! Te rog verifică-ți emailul pentru a confirma contul.' },
  company_name: { en: 'Company Name', ro: 'Nume Companie' }, business_reg_code: { en: 'Business Registration Code', ro: 'Cod de Înregistrare Fiscală' }, address: { en: 'Address', ro: 'Adresă' },
  generate_document: { en: 'Generate Document', ro: 'Generează Document' }, none: { en: 'None', ro: 'Niciunul' }, receipt: { en: 'Receipt', ro: 'Chitanță' },
  invoice: { en: 'Invoice', ro: 'Factură' }, client_name: { en: 'Client Name', ro: 'Nume Client' }, client_email: { en: 'Client Email (for sending)', ro: 'Email Client (pentru trimitere)' },
  service_description: { en: 'Service Description', ro: 'Descriere Serviciu' }, vat_rate: { en: 'VAT Rate', ro: 'Cotă TVA' },
  print: { en: 'Print', ro: 'Tipărește' }, send: { en: 'Send', ro: 'Trimite' }, from: { en: 'From:', ro: 'De la:' }, to: { en: 'To:', ro: 'Către:' },
  date_issued: { en: 'Date Issued:', ro: 'Data emiterii:' }, subtotal: { en: 'Subtotal', ro: 'Subtotal' }, vat: { en: 'VAT', ro: 'TVA' },
  total: { en: 'Total', ro: 'Total' }, thank_you: { en: 'Thank you for your business!', ro: 'Vă mulțumim!' },
  payment_received: { en: 'Payment received. Thank you!', ro: 'Plata a fost primită. Vă mulțumim!' },
  upload_avatar: { en: 'Upload a new picture', ro: 'Încarcă o poză nouă' },
  company_reg_number: { en: 'Company Registration Number', ro: 'Număr de Înregistrare Companie' },
  bank_name: { en: 'Bank Name', ro: 'Numele Băncii' },
  account_holder_name: { en: 'Account Holder Name', ro: 'Nume Deținător Cont' },
  account_number: { en: 'Account Number', ro: 'Număr Cont' },
  sort_code: { en: 'Sort Code', ro: 'Sort Code' },
  iban: { en: 'IBAN', ro: 'IBAN' },
  payment_link: { en: 'Payment Link', ro: 'Link Plată' },
  payment_details: { en: 'Payment Details', ro: 'Detalii Plată' },
  pay_now: { en: 'Pay Now', ro: 'Plătește Acum' },
  bank_details: { en: 'Bank Details', ro: 'Detalii Bancare' },
  company_number: { en: 'Company No:', ro: 'Nr. Înreg. Companie:' },
  vat_number: { en: 'Tax/VAT No:', ro: 'CUI/TVA:' },
  edit: { en: 'Edit', ro: 'Editează' },
  update: { en: 'Update', ro: 'Actualizează' },
  edit_transaction: { en: 'Edit Transaction', ro: 'Editează Tranzacția' },
  amount: { en: 'Amount', ro: 'Sumă' },
  category: { en: 'Category', ro: 'Categorie' },
  date: { en: 'Date', ro: 'Data' },
  document_details: { en: 'Document Details', ro: 'Detalii Document' },
  description: { en: 'Description', ro: 'Descriere' },
  take_photo: { en: 'Take Photo', ro: 'Fotografiază Chitanța' },
  upload_document: { en: 'Upload Document', ro: 'Încarcă Document' },
  capture: { en: 'Capture', ro: 'Capturează' },
  cancel: { en: 'Cancel', ro: 'Anulează' },
  remove: { en: 'Remove', ro: 'Elimină' },
};

const dateUtils = {
  isToday: (date: Date) => { const today = new Date(); return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); },
  isThisWeek: (date: Date) => { const today = new Date(); const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))); firstDayOfWeek.setHours(0, 0, 0, 0); const lastDayOfWeek = new Date(firstDayOfWeek); lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6); lastDayOfWeek.setHours(23, 59, 59, 999); return date >= firstDayOfWeek && date <= lastDayOfWeek; },
  isThisMonth: (date: Date) => { const today = new Date(); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); },
  getWeekOfMonth: (date: Date) => { const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); const offsetDate = date.getDate() + firstDayOfMonth - 1; return Math.floor(offsetDate / 7) + 1; }
};

const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string); reader.onerror = error => reject(error);
});

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
    
    const handlePhotoCapture = (capturedFile: File) => {
        setFile(capturedFile);
        setAttachmentBucket('receipts');
        fileToBase64(capturedFile).then(setFilePreview);
        setIsCameraOpen(false);
    };

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
            <CameraModal isOpen={isCameraOpen} onClose={() => setIsCameraOpen(false)} onCapture={handlePhotoCapture} t={t} />
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
    
    const incomeCategories = ['Cash', 'Card', 'Bank Transfer', 'Other'];
    const expenseCategories = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other'];
    const categories = formData.type === 'income' ? incomeCategories : expenseCategories;

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
    return ( <div className="category-breakdown-container"><h3>{title}</h3>{breakdown.length > 0 ? ( <ul className="category-list">{breakdown.map(({ category, amount, percentage }) => ( <li key={category} className="category-item"><div className="category-info"><span className="category-name">{category}</span><span className={`category-amount amount ${type}`}>{currencySymbol}{amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className={`progress-bar ${type}`} style={{ width: `${percentage}%` }} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={1