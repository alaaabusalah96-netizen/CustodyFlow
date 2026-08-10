import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';
import { CustodyDB } from '../../db';

describe('Layout Component (React Testing Library)', () => {
  it('renders layout header with active user full name', () => {
    const mockUser = {
      id: 'usr-1',
      full_name: 'علي عبد الله',
      email: 'ali@kemit.com',
      role: 'Admin' as const,
      company_id: 'comp-1',
      permissions: []
    };

    vi.spyOn(CustodyDB, 'getActiveUser').mockReturnValue(mockUser as any);

    render(
      <MemoryRouter>
        <Layout
          currentTab="dashboard"
          setCurrentTab={vi.fn()}
          language="ar"
          setLanguage={vi.fn()}
          theme="light"
          setTheme={vi.fn()}
          activeUser={mockUser as any}
          onLogout={vi.fn()}
        >
          <div>محتوى التطبيق الرئيسي</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('علي عبد الله')).toBeInTheDocument();
    expect(screen.getByText('محتوى التطبيق الرئيسي')).toBeInTheDocument();
  });
});
