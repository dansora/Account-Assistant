
import { User as SupabaseUser } from '@supabase/supabase-js';

export type DbTransaction = {
  id: number; user_id: string; created_at: string; date: string; type: 'income' | 'expense'; amount: number;
  category: string; document_type: 'receipt' | 'invoice' | null; document_number: string | null; client_name: string | null;
  client_email: string | null; service_description: string | null; attachment_url: string | null; attachment_bucket: string | null;
};

export type DbProfile = {
  id: string; updated_at: string | null; full_name: string | null; username: string | null; phone: string | null;
  avatar: string | null; company_name: string | null; business_registration_code: string | null; address: string | null; vat_rate: number;
  company_registration_number: string | null; bank_name: string | null; account_holder_name: string | null; account_number: string | null;
  sort_code: string | null; iban_code: string | null;
};

export type Transaction = {
  id: number; userId: string; createdAt: string; date: string; type: 'income' | 'expense'; amount: number; category: string;
  documentType?: 'receipt' | 'invoice'; documentNumber?: string; clientName?: string; clientEmail?: string; serviceDescription?: string; paymentLink?: string;
  attachmentUrl?: string; attachmentBucket?: string;
};

export type User = {
    id: string; updatedAt?: string; fullName: string; username: string; email: string; phone: string; avatar: string;
    companyName: string; businessRegistrationCode: string; address: string; vatRate: number;
    companyRegistrationNumber: string; bankName: string; accountHolderName: string; accountNumber: string; sortCode: string; iban: string;
};

export type AppView = { page: 'main' | 'income' | 'expense' | 'settings' | 'detail' | 'history' | 'tax' | 'profile'; period?: 'daily' | 'weekly' | 'monthly'; transactionType?: 'income' | 'expense'; };

export type Theme = 'light' | 'dark' | 'auto';
export type FontSize = 'small' | 'medium' | 'large';
export type Language = 'en' | 'ro';
export type Currency = 'GBP' | 'USD' | 'CAD' | 'AUD' | 'EUR' | 'JPY' | 'CNY' | 'CHF' | 'INR';
