import { http, HttpResponse } from 'msw';

export const handlers = [
  // Authentication endpoints
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as any;
    if (body.email === 'admin@kemit.com' && body.password === 'Password123!') {
      return HttpResponse.json({
        success: true,
        user: {
          id: 'user-admin-1',
          email: 'admin@kemit.com',
          full_name: 'مدير النظام',
          role: 'Admin',
          company_id: 'comp-1'
        },
        token: 'mock-jwt-token'
      });
    }
    return HttpResponse.json(
      { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' },
      { status: 401 }
    );
  }),

  http.get('/api/auth/me', () => {
    return HttpResponse.json({
      authenticated: true,
      user: {
        id: 'user-admin-1',
        email: 'admin@kemit.com',
        full_name: 'مدير النظام',
        role: 'Admin',
        company_id: 'comp-1'
      }
    });
  }),

  // User management endpoints
  http.get('/api/admin/users', () => {
    return HttpResponse.json({
      success: true,
      users: [
        {
          id: 'user-admin-1',
          full_name: 'أحمد محمود',
          email: 'admin@kemit.com',
          role: 'Admin',
          company_id: 'comp-1'
        },
        {
          id: 'user-station-1',
          full_name: 'محمود حسن',
          email: 'store@kemit.com',
          role: 'StationAdmin',
          company_id: 'comp-1'
        }
      ]
    });
  }),

  // Expenses & Transactions endpoints
  http.get('/api/transactions', () => {
    return HttpResponse.json({
      success: true,
      transactions: [
        {
          id: 'tx-101',
          transaction_no: 'EXP-2026-001',
          amount: 1500,
          category: 'وقود وصيانة',
          status: 'PENDING',
          company_id: 'comp-1',
          created_at: '2026-08-10'
        }
      ]
    });
  }),

  http.post('/api/transactions', async ({ request }) => {
    const newTx = (await request.json()) as any;
    return HttpResponse.json(
      {
        success: true,
        transaction: {
          id: `tx-${Date.now()}`,
          transaction_no: `EXP-${Date.now().toString().slice(-4)}`,
          status: 'PENDING',
          ...newTx
        }
      },
      { status: 201 }
    );
  }),

  http.post('/api/transactions/:id/approve', ({ params }) => {
    return HttpResponse.json({
      success: true,
      id: params.id,
      status: 'APPROVED'
    });
  }),

  // Inventory & Warehouse endpoints
  http.get('/api/inventory/documents', () => {
    return HttpResponse.json({
      success: true,
      documents: [
        {
          id: 'doc-001',
          document_no: 'GRN-2026-0001',
          doc_type: 'GOODS_RECEIPT',
          status: 'POSTED',
          items: [{ item_id: 'item-1', qty: 50, unit_price: 100 }]
        }
      ]
    });
  })
];
