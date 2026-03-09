import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        const msg = (result.error as { errors?: Array<{ message?: string }> }).errors?.[0]?.message ?? 'Validation error';
        res.status(400).json({ message: msg });
        return;
      }
      req.validated = result.data;
      next();
    } catch (e) {
      res.status(400).json({ message: (e as Error).message });
    }
  };
}

export const loginSchema = z.object({
  username: z.string().min(1, 'username required'),
  password: z.string().min(1, 'password required'),
});

export const forgotPasswordSchema = z.object({
  username: z.string().min(1, 'Kullanıcı adı gerekli'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token gerekli'),
  new_password: z.string().min(6, 'Şifre en az 6 karakter olmalı'),
  confirm_password: z.string().min(1, 'Şifre tekrarı gerekli'),
}).refine((d) => d.new_password === d.confirm_password, { message: 'Şifreler eşleşmiyor', path: ['confirm_password'] });

export const transferCallSchema = z.object({
  destination: z.string().min(1, 'Hedef gerekli (dahili veya numara)'),
  transfer_type: z.enum(['blind', 'attended']).optional().default('blind'),
});

export const initiateCallSchema = z.object({
  extension: z.string().min(1, 'extension required'),
  destination: z.string().min(1, 'destination required'),
  customer_id: z.string().uuid().optional(),
  external_id: z.string().optional(),
  external_type: z.string().optional(),
  callback_url: z.string().optional().refine((v) => !v || v.startsWith('http'), 'Invalid URL'),
  webrtc_direct: z.boolean().optional(),
});

export const customerSchema = z.object({
  phone_number: z.string().min(1, 'Telefon numarası gerekli'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  notes: z.string().optional(),
  debt_amount: z.preprocess(
    (v) => {
      if (v === '' || v === null || v === undefined) return undefined;
      if (typeof v === 'number' && isNaN(v)) return undefined;
      return v;
    },
    z.union([
      z.number(),
      z.string().transform((s) => {
        if (s === '') return undefined;
        const n = Number(s);
        return isNaN(n) ? undefined : n;
      }),
    ]).optional()
  ),
  last_payment_date: z.string().optional(),
  file_number: z.string().optional(),
  // Borçlu GSM raporu alanları
  takip_id: z.string().optional(),
  dosya_transfer_tarihi: z.string().optional(),
  buro_adi: z.string().optional(),
  dosya_asamasi: z.string().optional(),
  icrada_acilis_tarihi: z.string().optional(),
  kapanis_tipi: z.string().optional(),
  kapanis_tarihi: z.string().optional(),
  bildirim_tarihi: z.string().optional(),
  icra_dairesi: z.string().optional(),
  icra_no: z.string().optional(),
  tckn: z.string().optional(),
  fatura_id: z.string().optional(),
  musteri_no: z.string().optional(),
});

export const userCreateSchema = z.object({
  username: z.string().min(1, 'username required'),
  password: z.string().min(1, 'password required'),
  extension: z.string().optional(),
  role: z.enum(['admin', 'agent', 'supervisor']).optional(),
});

export const crmWebhookSchema = z.object({
  crm_webhook_url: z.union([z.string().url(), z.literal('')]).optional(),
  crm_webhook_secret: z.string().optional(),
  wallboard_public_token: z.string().optional(),
});

export const asteriskSchema = z.object({
  crm_webhook_url: z.string().optional(),
  crm_webhook_secret: z.string().optional(),
  wallboard_public_token: z.string().optional(),
  ami_host: z.string().optional(),
  ami_port: z.union([z.string(), z.number()]).optional(),
  ami_user: z.string().optional(),
  ami_secret: z.string().optional(),
  ami_dial_trunk: z.string().optional(),
  ami_dial_tech: z.string().optional(),
});
