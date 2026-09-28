import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      return res.status(422).json({
        sucesso: false,
        erro: 'Dados de entrada inválidos ou parâmetros obrigatórios ausentes.',
        detalhes: issues.map((err: any) => ({
          campo: Array.isArray(err.path) ? err.path.join('.') : '',
          mensagem: err.message
        }))
      });
    }
    req.body = result.data;
    next();
  };
};

const isProduction = process.env.NODE_ENV === 'production';

export const vendaSchema = z.object({
  lojaId: z.string().min(1, 'Identificador da loja é obrigatório.'),
  formaPagamento: z.enum(['DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'OUTROS']),
  valor: z.number().positive('O valor total da venda deve ser maior que zero.').optional(),
  descontoSolicitado: z.number().min(0, 'Desconto não pode ser negativo.').optional(),
  // simulateFailureAfterStock é estritamente proibido em produção e habilitado apenas para testes de rollback atômico
  simulateFailureAfterStock: isProduction ? z.never().optional() : z.boolean().optional(),
  itens: z.array(
    z.object({
      productId: z.string().min(1, 'ID do produto é obrigatório.'),
      quantity: z.number().int().positive('Quantidade deve ser um número inteiro positivo.'),
      unitPrice: z.number().positive('Preço unitário deve ser positivo.').optional()
    })
  ).min(1, 'A venda deve conter pelo menos um item.')
});

export const aberturaTurnoSchema = z.object({
  fundoTrocoInicial: z.number().min(0, 'Fundo de troco inicial não pode ser negativo.')
});

export const movimentacaoCaixaSchema = z.object({
  tipo: z.enum(['SANGRIA', 'SUPRIMENTO']),
  valor: z.number().positive('Valor da movimentação deve ser maior que zero.'),
  motivo: z.string().min(3, 'O motivo da movimentação deve ter pelo menos 3 caracteres.')
});

export const fechamentoCaixaSchema = z.object({
  dinheiroInformadoNaGaveta: z.number().min(0, 'Valor de dinheiro declarado não pode ser negativo.'),
  pixInformado: z.number().min(0).optional(),
  cartaoInformado: z.number().min(0).optional(),
  observacoes: z.string().optional()
});

export const supervisorPinSchema = z.object({
  pin: z.string().min(4, 'PIN deve ter no mínimo 4 dígitos.').max(8, 'PIN deve ter no máximo 8 dígitos.'),
  storeId: z.string().optional()
});

export const createEmployeeSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').max(100, 'Nome muito longo.'),
  email: z.string().trim().email('E-mail informado é inválido.').max(150),
  lojaId: z.string().min(1, 'Loja vinculada é obrigatória.'),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  role: z.literal('OPERADOR').optional()
});

export const updateEmployeeStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE'])
});

export const updateEmployeeStoreSchema = z.object({
  lojaId: z.string().min(1, 'Loja vinculada é obrigatória.')
});

export const acceptInvitationSchema = z.object({
  pin: z.string().min(4, 'PIN deve ter no mínimo 4 dígitos.').max(8, 'PIN deve ter no máximo 8 dígitos.').optional(),
  name: z.string().trim().min(2).optional()
});
