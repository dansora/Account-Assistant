
import { Currency, Language, DbTransaction, Transaction, DbProfile, User } from './types';

export const currencyMap: Record<Currency, string> = { 'GBP': '£', 'USD': '$', 'CAD': 'CA$', 'AUD': 'A$', 'EUR': '€', 'JPY': '¥', 'CNY': '¥', 'CHF': 'Fr', 'INR': '₹', };
export const languageToLocaleMap: Record<Language, string> = { 'en': 'en-GB', 'ro': 'ro-RO' };

export const translations: Record<string, Record<Language, string>> = {
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

export const dateUtils = {
  isToday: (date: Date) => { const today = new Date(); return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); },
  isThisWeek: (date: Date) => { const today = new Date(); const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1))); firstDayOfWeek.setHours(0, 0, 0, 0); const lastDayOfWeek = new Date(firstDayOfWeek); lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6); lastDayOfWeek.setHours(23, 59, 59, 999); return date >= firstDayOfWeek && date <= lastDayOfWeek; },
  isThisMonth: (date: Date) => { const today = new Date(); return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); },
  getWeekOfMonth: (date: Date) => { const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1).getDay(); const offsetDate = date.getDate() + firstDayOfMonth - 1; return Math.floor(offsetDate / 7) + 1; }
};

export const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string); reader.onerror = error => reject(error);
});

export const dbTransactionToApp = (dbTx: DbTransaction): Transaction => {
    const paymentLinkMarker = '[PAYMENT_LINK]';
    let serviceDescription = dbTx.service_description || undefined;
    let paymentLink: string | undefined;

    if (serviceDescription && serviceDescription.includes(paymentLinkMarker)) {
        const parts = serviceDescription.split(paymentLinkMarker);
        serviceDescription = parts[0].trim() || undefined;
        paymentLink = parts[1] || undefined;
    }

    return {
        id: dbTx.id, userId: dbTx.user_id, createdAt: dbTx.created_at, date: dbTx.date, type: dbTx.type, amount: dbTx.amount, category: dbTx.category,
        documentType: dbTx.document_type || undefined, documentNumber: dbTx.document_number || undefined, clientName: dbTx.client_name || undefined,
        clientEmail: dbTx.client_email || undefined,
        serviceDescription: serviceDescription,
        paymentLink: paymentLink,
        attachmentUrl: dbTx.attachment_url || undefined,
        attachmentBucket: dbTx.attachment_bucket || undefined,
    };
};

export const mapTransactionToDb = (appTx: Partial<Transaction>): Omit<DbTransaction, 'id' | 'created_at' | 'user_id'> & { user_id?: string } => {
    const paymentLinkMarker = '[PAYMENT_LINK]';
    let serviceDescription = appTx.serviceDescription || '';
    if (appTx.paymentLink) {
        serviceDescription = `${serviceDescription} ${paymentLinkMarker}${appTx.paymentLink}`;
    }

    return {
        user_id: appTx.userId, 
        date: appTx.date!, 
        type: appTx.type!, 
        amount: appTx.amount!, 
        category: appTx.category!,
        document_type: appTx.documentType || null, 
        document_number: appTx.documentNumber || null, 
        client_name: appTx.clientName || null,
        client_email: appTx.clientEmail || null,
        service_description: serviceDescription.trim() || null,
        attachment_url: appTx.attachmentUrl || null,
        attachment_bucket: appTx.attachmentBucket || null,
    };
};

export const dbProfileToApp = (dbProfile: DbProfile, authUser: User | any): User => {
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

export const appUserToDbProfile = (appUser: User): Omit<DbProfile, 'id' | 'updated_at'> => {
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

export const calculatePeriodTotals = (transactions: Transaction[]) => {
    const totals = { dailyIncome: 0, weeklyIncome: 0, monthlyIncome: 0, dailyExpenses: 0, weeklyExpenses: 0, monthlyExpenses: 0 };
    const lists = { dailyTransactions: [] as Transaction[], weeklyTransactions: [] as Transaction[], monthlyTransactions: [] as Transaction[] };
    
    transactions.forEach(tx => {
      const date = new Date(tx.date);
      if (dateUtils.isToday(date)) { 
          lists.dailyTransactions.push(tx); 
          if (tx.type === 'income') totals.dailyIncome += tx.amount; else totals.dailyExpenses += tx.amount; 
      }
      if (dateUtils.isThisWeek(date)) { 
          lists.weeklyTransactions.push(tx); 
          if (tx.type === 'income') totals.weeklyIncome += tx.amount; else totals.weeklyExpenses += tx.amount; 
      }
      if (dateUtils.isThisMonth(date)) { 
          lists.monthlyTransactions.push(tx); 
          if (tx.type === 'income') totals.monthlyIncome += tx.amount; else totals.monthlyExpenses += tx.amount; 
      }
    });
    return { ...totals, ...lists };
};
