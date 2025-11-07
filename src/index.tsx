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
  client_email: string | null; service_description: string | null;
};
type DbProfile = {
  id: string; updated_at: string | null; full_name: string | null; username: string | null; phone: string | null;
  avatar: string | null; company_name: string | null; business_registration_code: string | null; address: string | null; vat_rate: number;
  company_registration_number: string | null; bank_name: string | null;
};

type Transaction = {
  id: number; userId: string; createdAt: string; date: string; type: 'income' | 'expense'; amount: number; category: string;
  documentType?: 'receipt' | 'invoice'; documentNumber?: string; clientName?: string; clientEmail?: string; serviceDescription?: string; paymentLink?: string;
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
    };
};

const dbProfileToApp = (dbProfile: DbProfile, authUser: SupabaseUser): User => {
    const bankDetailsRaw = dbProfile.bank_name || '';
    
    const extractValue = (key: string): string => {
        const match = bankDetailsRaw.match(new RegExp(`\\[${key}\\](.*?)(?=\\[|$)`));
        return match ? match[1].trim() : '';
    };

    const accountHolderName = extractValue('HOLDER');
    const accountNumber = extractValue('ACC');
    const sortCode = extractValue('SORT');
    const iban = extractValue('IBAN');

    const firstMarkerIndex = bankDetailsRaw.indexOf('[');
    const bankName = (firstMarkerIndex === -1 ? bankDetailsRaw : bankDetailsRaw.substring(0, firstMarkerIndex)).trim();
    
    return {
        id: dbProfile.id, updatedAt: dbProfile.updated_at || undefined, fullName: dbProfile.full_name || '', username: dbProfile.username || '',
        email: authUser.email || '', phone: dbProfile.phone || '', avatar: dbProfile.avatar || '', companyName: dbProfile.company_name || '',
        businessRegistrationCode: dbProfile.business_registration_code || '', address: dbProfile.address || '', vatRate: dbProfile.vat_rate || 0,
        companyRegistrationNumber: dbProfile.company_registration_number || '', 
        bankName: bankName, 
        accountHolderName: accountHolderName, 
        accountNumber: accountNumber,
        sortCode: sortCode, 
        iban: iban,
    };
};

const appUserToDbProfile = (appUser: User): Omit<DbProfile, 'id' | 'updated_at'> => {
    let combinedBankDetails = appUser.bankName || '';
    if (appUser.accountHolderName) combinedBankDetails += ` [HOLDER]${appUser.accountHolderName}`;
    if (appUser.accountNumber) combinedBankDetails += ` [ACC]${appUser.accountNumber}`;
    if (appUser.sortCode) combinedBankDetails += ` [SORT]${appUser.sortCode}`;
    if (appUser.iban) combinedBankDetails += ` [IBAN]${appUser.iban}`;

    return {
        full_name: appUser.fullName,
        username: appUser.username,
        phone: appUser.phone,
        avatar: appUser.avatar,
        company_name: appUser.companyName,
        business_registration_code: appUser.businessRegistrationCode,
        address: appUser.address,
        vat_rate: appUser.vatRate,
        company_registration_number: appUser.companyRegistrationNumber, 
        bank_name: combinedBankDetails.trim() || null,
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

const NumpadModal = ({ isOpen, onClose, onSubmit, title, currencySymbol, categories, t }: { isOpen: boolean; onClose: () => void; onSubmit: (amount: number, category: string) => void; title: string; currencySymbol: string; categories?: string[]; t: (key: string) => string; }) => {
    const [inputValue, setInputValue] = useState('');
    const [selectedCategory, setSelectedCategory] = useState(categories && categories.length > 0 ? categories[0] : 'other');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    useEffect(() => { if (isOpen) { if (categories && categories.length > 0) setSelectedCategory(categories[0]); setInputValue(''); setIsCategoryOpen(false); } }, [isOpen, categories]);
    const handleButtonClick = (value: string) => { if (value === '.' && inputValue.includes('.')) return; setInputValue(inputValue + value); };
    const handleClear = () => setInputValue('');
    const handleEnter = () => { const amount = parseFloat(inputValue); if (!isNaN(amount) && amount > 0) { onSubmit(amount, selectedCategory); setInputValue(''); } };
    if (!isOpen) return null;
    const numpadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
    return (
        <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true"><div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{title || t('add_entry')}</h3><button onClick={onClose} className="close-button" aria-label="Close modal">&times;</button></div>
            {categories && categories.length > 0 && (<div className="category-selector">
                <button className="category-display-button" onClick={() => setIsCategoryOpen(!isCategoryOpen)} aria-haspopup="true" aria-expanded={isCategoryOpen}><span>{selectedCategory}</span><span className={`arrow ${isCategoryOpen ? 'up' : 'down'}`}></span></button>
                {isCategoryOpen && (<div className="category-dropdown">{categories.map(cat => (<button key={cat} className="category-dropdown-item" onClick={() => { setSelectedCategory(cat); setIsCategoryOpen(false); }}>{cat}</button>))}</div>)}
            </div>)}
            <div className="numpad-display" aria-live="polite">{currencySymbol}{inputValue || '0.00'}</div>
            <div className="numpad-grid">{numpadKeys.map(key => <button key={key} onClick={() => handleButtonClick(key)} className="numpad-button">{key}</button>)}<button onClick={handleClear} className="numpad-button action">{t('clear')}</button></div>
            <button onClick={handleEnter} className="numpad-enter-button">{t('enter')}</button>
        </div></div>
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
const DetailHeader = ({ title, onBack, t }: { title: string; onBack: () => void; t: (key: string) => string}) => (<div className="detail-header"><button onClick={onBack} className="back-button">&larr; {t('back')}</button><h2>{title}</h2></div>);
const TransactionListItem: React.FC<{ transaction: Transaction; currencySymbol: string; onDocClick: (tx: Transaction) => void; onEditClick: (tx: Transaction) => void; t: (key: string) => string; }> = ({ transaction, currencySymbol, onDocClick, onEditClick, t }) => (
    <li className="transaction-item">
        <div className="transaction-details">
            <span className="transaction-date">{new Date(transaction.date).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <div className="transaction-meta">
                <span className="transaction-category">{transaction.category}</span>
                {transaction.documentType && <button onClick={() => onDocClick(transaction)} className="document-badge">{t(transaction.documentType)} #{transaction.documentNumber}</button>}
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
    return ( <div className="category-breakdown-container"><h3>{title}</h3>{breakdown.length > 0 ? ( <ul className="category-list">{breakdown.map(({ category, amount, percentage }) => ( <li key={category} className="category-item"><div className="category-info"><span className="category-name">{category}</span><span className={`category-amount amount ${type}`}>{currencySymbol}{amount.toFixed(2)}</span></div><div className="progress-bar-container"><div className={`progress-bar ${type}`} style={{ width: `${percentage}%` }} role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100} aria-label={`${category} accounts for ${percentage.toFixed(1)}%`}></div></div><span className="category-percentage">{percentage.toFixed(1)}%</span></li> ))}</ul> ) : <p>{t('no_transactions_period')}</p>}</div> );
};

const MainPage = ({ income, expenses, onNavClick, currencySymbol, currentPeriod, onPeriodChange, locale, t }: { income: number; expenses: number; onNavClick: (page: 'income' | 'expense') => void; currencySymbol: string; currentPeriod: 'daily' | 'weekly' | 'monthly'; onPeriodChange: (period: 'daily' | 'weekly' | 'monthly') => void; locale: string; t: (key: string) => string; }) => (
    <div className="page-content">
        <CurrentDateTime locale={locale} /><h2>{t('dashboard')}</h2>
        <div className="cards-list">
            <div className="income-card-styled income clickable" onClick={() => onNavClick('income')}><div className="card-label"><h3>{t('income')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div>
            <div className="income-card-styled expense clickable" onClick={() => onNavClick('expense')}><div className="card-label"><h3>{t('expense')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div>
            <div className="income-card-styled balance"><div className="card-label"><h3>{t('balance')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{(income - expenses).toFixed(2)}</p></div></div>
        </div>
        <div className="period-selector"><button onClick={() => onPeriodChange('daily')} className={currentPeriod === 'daily' ? 'active' : ''}>{t('daily')}</button><button onClick={() => onPeriodChange('weekly')} className={currentPeriod === 'weekly' ? 'active' : ''}>{t('weekly')}</button><button onClick={() => onPeriodChange('monthly')} className={currentPeriod === 'monthly' ? 'active' : ''}>{t('monthly')}</button></div>
    </div>
);

const IncomePage = ({ income, weeklyIncome, monthlyIncome, addIncome, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: { income: number; weeklyIncome: number; monthlyIncome: number; addIncome: (data: any) => void; onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void; currencySymbol: string; dailyTransactions: Transaction[]; weeklyTransactions: Transaction[]; monthlyTransactions: Transaction[]; locale: string; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const [isModalOpen, setIsModalOpen] = useState(false); const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily'); const incomeCategories = ['Cash', 'Card', 'Bank Transfer', 'Other']; const handleAddIncome = (data: any) => { addIncome(data); setIsModalOpen(false); }; const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions; const currentTotal = period === 'daily' ? income : period === 'weekly' ? weeklyIncome : monthlyIncome;
    return (
        <div className="page-content">
            <CurrentDateTime locale={locale} /><h2>{t('income')}</h2><button className="action-button" onClick={() => setIsModalOpen(true)}>{t('add_income')}</button>
            <div className="cards-list">
                <div className="income-card-styled income clickable" onClick={() => onCardClick('daily')}><div className="card-label"><h3>{t('daily')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{income.toFixed(2)}</p></div></div>
                <div className="income-card-styled income clickable" onClick={() => onCardClick('weekly')}><div className="card-label"><h3>{t('weekly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{weeklyIncome.toFixed(2)}</p></div></div>
                <div className="income-card-styled income clickable" onClick={() => onCardClick('monthly')}><div className="card-label"><h3>{t('monthly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{monthlyIncome.toFixed(2)}</p></div></div>
            </div>
            <CategoryBreakdown title={t('income_breakdown', { period: t(period) })} transactions={currentTransactions} totalAmount={currentTotal} currencySymbol={currencySymbol} type="income" t={t} />
            <div className="period-selector"><button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button><button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button><button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button></div>
            <IncomeNumpadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddIncome} title={t('add_income')} currencySymbol={currencySymbol} categories={incomeCategories} t={t} />
        </div>
    );
};
const ExpensePage = ({ expenses, weeklyExpenses, monthlyExpenses, addExpense, onCardClick, currencySymbol, dailyTransactions, weeklyTransactions, monthlyTransactions, locale, t }: { expenses: number; weeklyExpenses: number; monthlyExpenses: number; addExpense: (amount: number, category: string) => void; onCardClick: (period: 'daily' | 'weekly' | 'monthly') => void; currencySymbol: string; dailyTransactions: Transaction[]; weeklyTransactions: Transaction[]; monthlyTransactions: Transaction[]; locale: string; t: (key: string, replacements?: Record<string, string>) => string; }) => {
    const [isModalOpen, setIsModalOpen] = useState(false); const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily'); const expenseCategories = ['Fuel', 'Repairs', 'Insurance', 'Rent', 'Phone', 'Subscriptions', 'Fees & Tolls', 'Other']; const handleAddExpense = (amount: number, category: string) => { addExpense(amount, category); setIsModalOpen(false); }; const currentTransactions = period === 'daily' ? dailyTransactions : period === 'weekly' ? weeklyTransactions : monthlyTransactions; const currentTotal = period === 'daily' ? expenses : period === 'weekly' ? weeklyExpenses : monthlyExpenses;
    return (
      <div className="page-content">
        <CurrentDateTime locale={locale} /><h2>{t('expense')}</h2><button className="action-button expense" onClick={() => setIsModalOpen(true)}>{t('add_expense')}</button>
        <div className="cards-list">
            <div className="income-card-styled expense clickable" onClick={() => onCardClick('daily')}><div className="card-label"><h3>{t('daily')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{expenses.toFixed(2)}</p></div></div>
            <div className="income-card-styled expense clickable" onClick={() => onCardClick('weekly')}><div className="card-label"><h3>{t('weekly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{weeklyExpenses.toFixed(2)}</p></div></div>
            <div className="income-card-styled expense clickable" onClick={() => onCardClick('monthly')}><div className="card-label"><h3>{t('monthly')}</h3></div><div className="card-value"><p className="amount">{currencySymbol}{monthlyExpenses.toFixed(2)}</p></div></div>
        </div>
        <CategoryBreakdown title={t('expense_breakdown', { period: t(period) })} transactions={currentTransactions} totalAmount={currentTotal} currencySymbol={currencySymbol} type="expense" t={t} />
        <div className="period-selector"><button onClick={() => setPeriod('daily')} className={period === 'daily' ? 'active' : ''}>{t('daily')}</button><button onClick={() => setPeriod('weekly')} className={period === 'weekly' ? 'active' : ''}>{t('weekly')}</button><button onClick={() => setPeriod('monthly')} className={period === 'monthly' ? 'active' : ''}>{t('monthly')}</button></div>
        <NumpadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddExpense} title={t('add_expense')} currencySymbol={currencySymbol} categories={expenseCategories} t={t} />
      </div>
    );
};

const ContactModal = ({ isOpen, onClose, t }: { isOpen: boolean; onClose: () => void; t: (key: string) => string; }) => {
    const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [phone, setPhone] = useState(''); const [message, setMessage] = useState('');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const subject = `Message from ${name} via Account Assistant`; const body = `Name: ${name}\nEmail: ${email}\nPhone: ${phone || 'Not provided'}\n\nMessage:\n${message}`; window.location.href = `mailto:support@example.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; onClose(); };
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}><div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>{t('contact_us')}</h3><button onClick={onClose} className="close-button">&times;</button></div>
            <p className="contact-intro">{t('contact_intro')}</p>
            <form className="contact-form" onSubmit={handleSubmit}>
                <div className="form-field"><label htmlFor="c-name">{t('contact_name')}</label><input id="c-name" type="text" value={name} onChange={e => setName(e.target.value)} required placeholder={t('contact_your_name')} /></div>
                <div className="form-field"><label htmlFor="c-email">{t('contact_email')}</label><input id="c-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder={t('contact_your_email')} /></div>
                <div className="form-field"><label htmlFor="c-phone">{t('contact_phone')}</label><input id="c-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('contact_your_phone')} /></div>
                <div className="form-field"><label htmlFor="c-message">{t('contact_message')}</label><textarea id="c-message" value={message} onChange={e => setMessage(e.target.value)} required rows={5} placeholder={t('contact_enter_message')} /></div>
                <button type="submit" className="action-button">{t('send_message')}</button>
            </form>
        </div></div>
    );
};

const SettingsPage = ({ theme, onThemeChange, currency, onCurrencyChange, fontSize, onFontSizeChange, vatRate, onVatChange, t }: { theme: Theme; onThemeChange: (theme: Theme) => void; currency: Currency; onCurrencyChange: (currency: Currency) => void; fontSize: FontSize; onFontSizeChange: (size: FontSize) => void; vatRate: number; onVatChange: (rate: number) => void; t: (key: string) => string; }) => {
    const [isContactModalOpen, setIsContactModalOpen] = useState(false);
    const vatRates = [0, 5, 7, 9, 19, 20, 21, 24, 25];
    return (
        <div className="page-content">
            <h2>{t('settings')}</h2>
            <div className="settings-group"><h3>{t('appearance')}</h3><div className="theme-selector"><button onClick={() => onThemeChange('light')} className={theme === 'light' ? 'active' : ''}>{t('light')}</button><button onClick={() => onThemeChange('dark')} className={theme === 'dark' ? 'active' : ''}>{t('dark')}</button><button onClick={() => onThemeChange('auto')} className={theme === 'auto' ? 'active' : ''}>{t('auto')}</button></div></div>
            <div className="settings-group"><h3>{t('font_size')}</h3><div className="theme-selector"><button onClick={() => onFontSizeChange('small')} className={fontSize === 'small' ? 'active' : ''}>{t('small')}</button><button onClick={() => onFontSizeChange('medium')} className={fontSize === 'medium' ? 'active' : ''}>{t('medium')}</button><button onClick={() => onFontSizeChange('large')} className={fontSize === 'large' ? 'active' : ''}>{t('large')}</button></div></div>
            <div className="settings-group"><h3>{t('currency')}</h3><select className="currency-selector" value={currency} onChange={(e) => onCurrencyChange(e.target.value as Currency)}>{Object.entries(currencyMap).map(([code, symbol]) => (<option key={code} value={code}>{code} ({symbol})</option>))}</select></div>
            <div className="settings-group"><h3>{t('vat_rate')}</h3><select className="currency-selector" value={vatRate} onChange={e => onVatChange(parseFloat(e.target.value) || 0)}>{vatRates.map(rate => <option key={rate} value={rate}>{rate}%</option>)}</select></div>
            <div className="settings-group"><h3>{t('contact_us')}</h3><p className="contact-intro">{t('contact_intro')}</p><button className="action-button settings-action" onClick={() => setIsContactModalOpen(true)}>{t('contact_us')}</button></div>
            <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} t={t} />
        </div>
    );
};

const TaxPage = ({ transactions, currencySymbol, t }: { transactions: Transaction[]; currencySymbol: string; t: (key: string) => string; }) => {
    const [startDate, setStartDate] = useState<Date | null>(null); const [endDate, setEndDate] = useState<Date | null>(null); const [isCalendarOpen, setCalendarOpen] = useState<'start' | 'end' | null>(null); const [reportReady, setReportReady] = useState(false);
    const reportData = useMemo(() => { if (!startDate || !endDate || endDate < startDate) return null; const start = new Date(startDate.setHours(0, 0, 0, 0)); const end = new Date(endDate.setHours(23, 59, 59, 999)); const filtered = transactions.filter(tx => { const txDate = new Date(tx.date); return txDate >= start && txDate <= end; }); const totals = filtered.reduce((acc, tx) => { if (tx.type === 'income') acc.income += tx.amount; else acc.expense += tx.amount; return acc; }, { income: 0, expense: 0 }); return { transactions: filtered, totalIncome: totals.income, totalExpense: totals.expense, balance: totals.income - totals.expense, }; }, [transactions, startDate, endDate]);
    const generateCSV = () => { if (!reportData) return; let csvContent = "Date,Type,Amount,Category,Document,Client\n"; reportData.transactions.forEach(tx => { csvContent += `${new Date(tx.date).toLocaleString()},${tx.type},${tx.amount.toFixed(2)},${tx.category},${tx.documentNumber || ''},${tx.clientName || ''}\n`; }); csvContent += `\nTotal Income,${reportData.totalIncome.toFixed(2)}\nTotal Expense,${reportData.totalExpense.toFixed(2)}\nBalance,${reportData.balance.toFixed(2)}\n`; const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; const dateString = `${startDate!.toISOString().split('T')[0]}_to_${endDate!.toISOString().split('T')[0]}`; link.download = `tax-report-${dateString}.csv`; document.body.appendChild(link); link.click(); document.body.removeChild(link); setReportReady(true); };
    const sendEmail = () => { const subject = "Tax Report"; const body = `Hello,\n\nPlease find my tax report attached for the period from ${startDate!.toLocaleDateString()} to ${endDate!.toLocaleDateString()}.\n\nThank you.`; window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; };
    return (
        <div className="page-content">
            <h2>{t('tax_report')}</h2><p className="page-subtitle">{t('tax_subtitle')}</p>
            <div className="date-selector-container"><div className="date-selector" onClick={() => setCalendarOpen('start')}><label>{t('start_date')}</label><span>{startDate ? startDate.toLocaleDateString() : t('select_date')}</span></div><div className="date-selector" onClick={() => setCalendarOpen('end')}><label>{t('end_date')}</label><span>{endDate ? endDate.toLocaleDateString() : t('select_date')}</span></div></div>
            {reportData && (<div className="report-summary"><h3>{t('report_summary')}</h3><div className="summary-item"><span>{t('total_income')}</span><span className="amount income">{currencySymbol}{reportData.totalIncome.toFixed(2)}</span></div><div className="summary-item"><span>{t('total_expense')}</span><span className="amount expense">{currencySymbol}{reportData.totalExpense.toFixed(2)}</span></div><div className="summary-item"><span>{t('balance')}</span><span className="amount balance">{currencySymbol}{reportData.balance.toFixed(2)}</span></div>{!reportReady ? <button className="action-button" onClick={generateCSV}>{t('download_csv')}</button> : <button className="action-button income" onClick={sendEmail}>{t('send_email')}</button>}</div>)}
            <CalendarModal isOpen={!!isCalendarOpen} onClose={() => setCalendarOpen(null)} onSelectDate={date => { if (isCalendarOpen === 'start') setStartDate(date); if (isCalendarOpen === 'end') setEndDate(date); }} />
        </div>
    );
};

const Header = ({ t, language, onLanguageChange, user, onNavClick }: { t: (key: string) => string; language: Language; onLanguageChange: (lang: Language) => void; user: User | null; onNavClick: (page: string) => void; }) => {
    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2);
    return(
      <header className="app-header">
        <div className="header-content"><h1>{t('welcome')}</h1><p className="slogan">{t('slogan')}</p></div>
        <div className="header-controls">
            <div className="language-selector-wrapper">
                <select className="language-selector" value={language} onChange={e => onLanguageChange(e.target.value as Language)}>
                    <option value="en">EN</option><option value="ro">RO</option>
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M7 10l5 5 5-5H7z"/></svg>
            </div>
            {user && (<button className="profile-button" onClick={() => onNavClick('profile')} aria-label={t('profile')}>
                {user.avatar ? <img src={user.avatar} alt="User Avatar" className="profile-avatar-icon" /> : <div className="profile-initials-icon">{getInitials(user.fullName)}</div>}
            </button>)}
        </div>
      </header>
    );
};

const HomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>;
const IncomeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13 19V7.83l4.59 4.58L19 11l-7-7-7 7 1.41 1.41L11 7.83V19h2z"/></svg>;
const ExpenseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11 5v11.17l-4.59-4.58L5 13l7 7 7-7-1.41-1.41L13 16.17V5h-2z"/></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69-.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59-1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>;
const TaxIcon = () => <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm-1 11h-2v2H9v-2H7v-2h2V9h2v2h2v2zm4-6V3.5L18.5 9H13z"/></svg>;
const Footer = ({ currentPage, onNavClick, t }: { currentPage: string; onNavClick: (page: string) => void; t: (key: string) => string; }) => {
    const navItems = [{ page: 'main', label: t('home'), icon: <HomeIcon /> }, { page: 'income', label: t('income'), icon: <IncomeIcon /> }, { page: 'expense', label: t('expense'), icon: <ExpenseIcon /> }, { page: 'tax', label: t('tax'), icon: <TaxIcon /> }, { page: 'settings', label: t('settings'), icon: <SettingsIcon /> }, ];
    return ( <footer className="app-footer"><nav>{navItems.map(item => (<button key={item.page} className={currentPage === item.page ? 'active' : ''} onClick={() => onNavClick(item.page)} aria-label={`Go to ${item.label} page`}>{item.icon}<span>{item.label}</span></button>))}</nav></footer> );
};
const ScrollToTop = ({ mainRef }: { mainRef: React.RefObject<HTMLElement> }) => {
    const [isVisible, setIsVisible] = useState(false); const handleScroll = () => { if (mainRef.current) setIsVisible(mainRef.current.scrollTop > 300); }; const scrollToTop = () => { if (mainRef.current) mainRef.current.scrollTo({ top: 0, behavior: 'smooth' }); }; useEffect(() => { const mainElement = mainRef.current; mainElement?.addEventListener('scroll', handleScroll); return () => mainElement?.removeEventListener('scroll', handleScroll); }, [mainRef]); if (!isVisible) return null;
    return <button className="scroll-to-top-button" onClick={scrollToTop} aria-label="Scroll to top"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg></button>;
};

const ProfilePage = ({ user, onUpdate, onLogout, onBack, t }: { user: User; onUpdate: (updatedUser: User) => Promise<void>; onLogout: () => void; onBack: () => void; t: (key: string) => string; }) => {
    const [formData, setFormData] = useState(user);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const avatarInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setFormData(user);
    }, [user]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files && e.target.files[0]) { const base64 = await fileToBase64(e.target.files[0]); setFormData({ ...formData, avatar: base64 }); } };
    const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); setIsSubmitting(true); await onUpdate(formData); setIsSubmitting(false); };
    return (
        <div className="page-content">
            <DetailHeader title={t('profile')} onBack={onBack} t={t} />
            <form onSubmit={handleSubmit} className="profile-form">
                <div className="profile-avatar-section">
                    <img src={formData.avatar || 'https://via.placeholder.com/120'} alt="Profile Avatar" className="profile-avatar-preview" />
                    <button type="button" className="action-button" onClick={() => avatarInputRef.current?.click()}>{t('upload_avatar')}</button>
                    <input type="file" ref={avatarInputRef} onChange={handleAvatarChange} accept="image/*" style={{ display: 'none' }} />
                </div>
                <div className="form-field"><label htmlFor="fullName">{t('full_name')}</label><input id="fullName" name="fullName" type="text" value={formData.fullName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="username">{t('username')}</label><input id="username" name="username" type="text" value={formData.username} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="email">{t('email_address')}</label><input id="email" name="email" type="email" value={formData.email} disabled /></div>
                <div className="form-field"><label htmlFor="phone">{t('phone_number')}</label><input id="phone" name="phone" type="tel" value={formData.phone} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="companyName">{t('company_name')}</label><input id="companyName" name="companyName" type="text" value={formData.companyName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="businessRegistrationCode">{t('business_reg_code')}</label><input id="businessRegistrationCode" name="businessRegistrationCode" type="text" value={formData.businessRegistrationCode} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="companyRegistrationNumber">{t('company_reg_number')}</label><input id="companyRegistrationNumber" name="companyRegistrationNumber" type="text" value={formData.companyRegistrationNumber} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="address">{t('address')}</label><textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={3}></textarea></div>
                <h3 className="profile-form-section-header">{t('bank_details')}</h3>
                <div className="form-field"><label htmlFor="bankName">{t('bank_name')}</label><input id="bankName" name="bankName" type="text" value={formData.bankName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="accountHolderName">{t('account_holder_name')}</label><input id="accountHolderName" name="accountHolderName" type="text" value={formData.accountHolderName} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="accountNumber">{t('account_number')}</label><input id="accountNumber" name="accountNumber" type="text" value={formData.accountNumber} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="sortCode">{t('sort_code')}</label><input id="sortCode" name="sortCode" type="text" value={formData.sortCode} onChange={handleChange} /></div>
                <div className="form-field"><label htmlFor="iban">{t('iban')}</label><input id="iban" name="iban" type="text" value={formData.iban} onChange={handleChange} /></div>
                <button type="submit" className="action-button" disabled={isSubmitting}>{isSubmitting ? <div className="button-spinner"></div> : t('update_profile')}</button>
            </form>
            <button onClick={onLogout} className="action-button expense">{t('logout')}</button>
        </div>
    );
};

const AuthPage = ({ onLogin, onSignup, t }: {
    onLogin: (email: string, pass: string) => Promise<{ error: any | null }>;
    onSignup: (email: string, pass: string, fullName: string, username: string) => Promise<{ data: { user: SupabaseUser | null, session: Session | null }, error: any | null }>;
    t: (key: string) => string;
}) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsSubmitting(true);

        if (isLoginView) {
            const { error } = await onLogin(email, password);
            if (error) {
                setError(error.message || t('login_failed'));
            }
        } else {
            const { data, error } = await onSignup(email, password, fullName, username);
            if (error) {
                if (error.message.toLowerCase().includes('user already registered') || error.message.toLowerCase().includes('duplicate key value violates unique constraint')) {
                     setError(t('signup_failed'));
                } else {
                    setError(t('signup_generic_error'));
                }
            } else if (data.user && !data.session) {
                setSuccessMessage(t('check_email_confirmation'));
                setEmail('');
                setPassword('');
                setFullName('');
                setUsername('');
            }
        }
        setIsSubmitting(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">{isLoginView ? t('login') : t('signup')}</h1>
                {successMessage ? (
                    <p className="auth-success">{successMessage}</p>
                ) : (
                    <form onSubmit={handleSubmit} className="auth-form">
                        {!isLoginView && (
                            <>
                                <div className="form-field"><label htmlFor="auth-fullname">{t('full_name')}</label><input id="auth-fullname" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={isSubmitting} /></div>
                                <div className="form-field"><label htmlFor="auth-username">{t('username')}</label><input id="auth-username" type="text" value={username} onChange={e => setUsername(e.target.value)} required disabled={isSubmitting} /></div>
                            </>
                        )}
                        <div className="form-field"><label htmlFor="auth-email">{t('email_address')}</label><input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} /></div>
                        <div className="form-field"><label htmlFor="auth-password">{t('password')}</label><input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isSubmitting} /></div>
                        {error && <p className="auth-error">{error}</p>}
                        <button type="submit" className="action-button auth-submit" disabled={isSubmitting}>{isSubmitting ? <div className="button-spinner"></div> : (isLoginView ? t('login') : t('signup'))}</button>
                    </form>
                )}
                <button onClick={() => { setIsLoginView(!isLoginView); setError(''); setSuccessMessage(''); }} className="auth-toggle" disabled={isSubmitting}>{isLoginView ? t('no_account') : t('has_account')}</button>
            </div>
        </div>
    );
};


function App() {
  const mainRef = useRef<HTMLElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<AppView>({ page: 'main' });
  const [viewingDocument, setViewingDocument] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<Theme>('auto');
  const [fontSize, setFontSize] = useState<FontSize>('medium');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [language, setLanguage] = useState<Language>( (localStorage.getItem('language') as Language) || 'en');
  const [mainViewPeriod, setMainViewPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const t = useCallback((key: string, replacements: Record<string, string> = {}) => { let translation = translations[key]?.[language] || key; Object.entries(replacements).forEach(([k, v]) => { translation = translation.replace(`{${k}}`, v); }); return translation; }, [language]);
  useEffect(() => { localStorage.setItem('language', language); }, [language]);

  useEffect(() => {
    const fetchSessionData = async (session: Session) => {
      setIsLoading(true);
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (profileError) console.error('Error fetching profile:', profileError);
      else if (profileData) {
        const appUser = dbProfileToApp(profileData, session.user);
        setUser(appUser);
        setTheme((localStorage.getItem(`theme_${appUser.id}`) as Theme) || 'auto');
        setFontSize((localStorage.getItem(`fontSize_${appUser.id}`) as FontSize) || 'medium');
        setCurrency((localStorage.getItem(`currency_${appUser.id}`) as Currency) || 'GBP');
        const { data: transactionData, error: transactionError } = await supabase.from('transactions').select('*').eq('user_id', session.user.id).order('date', { ascending: false });
        if(transactionError) console.error('Error fetching transactions:', transactionError);
        else setTransactions(transactionData.map(dbTransactionToApp));
      }
      setIsLoading(false);
    };
    supabase.auth.getSession().then(({ data: { session } }) => { setSession(session); if (session) { fetchSessionData(session); } else { setIsLoading(false); } });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); if (session?.user) { fetchSessionData(session); } else { setUser(null); setIsLoading(false); } });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (user) localStorage.setItem(`currency_${user.id}`, currency); }, [currency, user]);
  useEffect(() => { if (user) localStorage.setItem(`fontSize_${user.id}`, fontSize); document.documentElement.style.fontSize = ({ small: '14px', medium: '16px', large: '18px' })[fontSize]; }, [fontSize, user]);
  useEffect(() => { if (!user) return; localStorage.setItem(`theme_${user.id}`, theme); const body = document.body; body.classList.remove('light-theme', 'dark-theme'); if (theme === 'auto') { const mq = window.matchMedia('(prefers-color-scheme: dark)'); const h = () => body.classList.toggle('dark-theme', mq.matches); h(); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h); } else { body.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme'); } }, [theme, user]);

  const handleLogin = async (email: string, pass: string) => {
    return supabase.auth.signInWithPassword({ email, password: pass });
  };
  const handleSignup = async (email: string, pass: string, fullName: string, username: string) => {
    return supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: fullName, username: username } }
    });
  };
  const handleLogout = async () => { await supabase.auth.signOut(); setUser(null); setView({ page: 'main' }); };
  const handleUpdateProfile = async (updatedUser: User) => {
    const { data, error } = await supabase.from('profiles').update(appUserToDbProfile(updatedUser)).eq('id', updatedUser.id).select().single();
    if (error) {
        console.error("Failed to update profile", error);
        alert(`Failed to update profile: ${error.message}`);
    } else if (data && session?.user) {
        setUser(dbProfileToApp(data, session.user));
        setView({ page: 'main' });
    }
  };
  const handleVatChange = (rate: number) => { if (user) handleUpdateProfile({ ...user, vatRate: rate }); };
  
  const currencySymbol = useMemo(() => currencyMap[currency], [currency]);
  const locale = useMemo(() => languageToLocaleMap[language], [language]);

  const addTransaction = useCallback(async (data: { type: 'income' | 'expense', amount: number, category: string, documentType?: 'receipt' | 'invoice', clientName?: string, clientEmail?: string, serviceDescription?: string, paymentLink?: string }) => {
    if (!user) return;
    const prefix = data.documentType === 'invoice' ? 'FACT-' : 'CHIT-';
    const newTx: Partial<Transaction> = { userId: user.id, type: data.type, amount: data.amount, category: data.category, date: new Date().toISOString(), documentType: data.documentType, clientName: data.clientName, clientEmail: data.clientEmail, serviceDescription: data.serviceDescription, paymentLink: data.paymentLink, documentNumber: data.documentType ? `${prefix}${Date.now()}` : undefined };
    const { data: inserted, error } = await supabase.from('transactions').insert(appTransactionToDb(newTx)).select().single();
    if (error) console.error('Error adding transaction:', error);
    else if (inserted) setTransactions(prev => [dbTransactionToApp(inserted), ...prev]);
  }, [user]);

  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    const dbPayload = appTransactionToDb(updatedTx);
    delete (dbPayload as { user_id?: string }).user_id;

    const { data, error } = await supabase
        .from('transactions')
        .update(dbPayload)
        .eq('id', updatedTx.id)
        .select()
        .single();

    if (error) {
        console.error('Error updating transaction:', error);
        alert(`Failed to save transaction: ${error.message}`);
    } else if (data) {
        const newlyUpdatedTx = dbTransactionToApp(data);
        setTransactions(prevTxs =>
            prevTxs.map(tx => (tx.id === updatedTx.id ? newlyUpdatedTx : tx))
        );
        setEditingTransaction(null);
    }
  };

  const { dailyIncome, weeklyIncome, monthlyIncome, dailyExpenses, weeklyExpenses, monthlyExpenses, dailyTransactions, weeklyTransactions, monthlyTransactions } = useMemo(() => {
    const totals = { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0 };
    const filteredLists = { dailyTransactions: [] as Transaction[], weeklyTransactions: [] as Transaction[], monthlyTransactions: [] as Transaction[] };
    transactions.forEach(tx => { const date = new Date(tx.date); if (dateUtils.isToday(date)) { filteredLists.dailyTransactions.push(tx); if (tx.type === 'income') totals.dailyIncome += tx.amount; else totals.dailyExpenses += tx.amount; } if (dateUtils.isThisWeek(date)) { filteredLists.weeklyTransactions.push(tx); if (tx.type === 'income') totals.weeklyIncome += tx.amount; else totals.weeklyExpenses += tx.amount; } if (dateUtils.isThisMonth(date)) { filteredLists.monthlyTransactions.push(tx); if (tx.type === 'income') totals.monthlyIncome += tx.amount; else totals.monthlyExpenses += tx.amount; } });
    return {...totals, ...filteredLists};
  }, [transactions]);

  const handleNavClick = (page: 'main' | 'income' | 'expense' | 'settings' | 'tax' | 'profile') => setView({ page });
  const handleCardClick = (type: 'income' | 'expense', period: 'daily' | 'weekly' | 'monthly') => setView({ page: 'detail', transactionType: type, period });
  
  if (isLoading) { return <div className="loading-spinner"></div>; }
  if (!session || !user) { return <AuthPage onLogin={handleLogin} onSignup={handleSignup} t={t} />; }

  const renderPage = () => {
    const { page, period, transactionType } = view;
    if (page === 'history') { const allTypeTransactions = transactions.filter(tx => tx.type === transactionType); return <HistoryPage transactions={allTypeTransactions} type={transactionType!} onBack={() => handleCardClick(transactionType!, 'monthly')} currencySymbol={currencySymbol} t={t} />; }
    if (page === 'detail' && transactionType && period) {
        const filters = { daily: dateUtils.isToday, weekly: dateUtils.isThisWeek, monthly: dateUtils.isThisMonth };
        const relevantTransactions = transactions.filter(tx => tx.type === transactionType && filters[period!](new Date(tx.date)));
        const onBack = () => setView({ page: transactionType });
        const onViewHistory = () => setView({ page: 'history', transactionType });
        const onDocClick = (tx: Transaction) => setViewingDocument(tx);
        const onEditClick = (tx: Transaction) => setEditingTransaction(tx);
        switch (period) {
            case 'daily': return <DailyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />;
            case 'weekly': return <WeeklyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />;
            case 'monthly': return <MonthlyDetailPage transactions={relevantTransactions} type={transactionType} onBack={onBack} onViewHistory={onViewHistory} currencySymbol={currencySymbol} onDocClick={onDocClick} onEditClick={onEditClick} t={t} />;
            default: setView({ page: 'main' }); return null;
        }
    }
    switch (page) {
        case 'income': return <IncomePage income={dailyIncome} weeklyIncome={weeklyIncome} monthlyIncome={monthlyIncome} addIncome={(data) => addTransaction({ ...data, type: 'income' })} onCardClick={(p) => handleCardClick('income', p)} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
        case 'expense': return <ExpensePage expenses={dailyExpenses} weeklyExpenses={weeklyExpenses} monthlyExpenses={monthlyExpenses} addExpense={(amount, category) => addTransaction({ type: 'expense', amount, category })} onCardClick={(p) => handleCardClick('expense', p)} currencySymbol={currencySymbol} dailyTransactions={dailyTransactions} weeklyTransactions={weeklyTransactions} monthlyTransactions={monthlyTransactions} locale={locale} t={t} />;
        case 'settings': return <SettingsPage theme={theme} onThemeChange={setTheme} currency={currency} onCurrencyChange={setCurrency} fontSize={fontSize} onFontSizeChange={setFontSize} vatRate={user.vatRate} onVatChange={handleVatChange} t={t} />;
        case 'tax': return <TaxPage transactions={transactions} currencySymbol={currencySymbol} t={t} />;
        case 'profile': return <ProfilePage user={user} onUpdate={handleUpdateProfile} onLogout={handleLogout} onBack={() => setView({ page: 'main' })} t={t} />;
        case 'main': default:
            let incomeForPeriod = dailyIncome, expensesForPeriod = dailyExpenses;
            if (mainViewPeriod === 'weekly') { incomeForPeriod = weeklyIncome; expensesForPeriod = weeklyExpenses; } else if (mainViewPeriod === 'monthly') { incomeForPeriod = monthlyIncome; expensesForPeriod = monthlyExpenses; }
            return <MainPage income={incomeForPeriod} expenses={expensesForPeriod} onNavClick={(p) => handleNavClick(p as any)} currencySymbol={currencySymbol} currentPeriod={mainViewPeriod} onPeriodChange={setMainViewPeriod} locale={locale} t={t} />;
    }
  };

  return (
    <div className="app-container">
      <Header t={t} language={language} onLanguageChange={setLanguage} user={user} onNavClick={handleNavClick as (page: string) => void} />
      <main ref={mainRef}>{renderPage()}</main>
      <Footer currentPage={view.page} onNavClick={handleNavClick as (page: string) => void} t={t} />
      <ScrollToTop mainRef={mainRef} />
      <DocumentViewerModal transaction={viewingDocument} user={user} currencySymbol={currencySymbol} onClose={() => setViewingDocument(null)} t={t} />
      <EditTransactionModal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} onSubmit={handleUpdateTransaction} transaction={editingTransaction} t={t} />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
