import React, { useEffect, useState } from 'react';
import { LogsModule } from '../db/logs';
import { CustodyDB } from '../db';
import { ShieldAlert } from 'lucide-react';

interface FuelComparisonProps {
  language: 'en' | 'ar';
  theme: 'light' | 'dark';
}

export default function FuelComparison({ language, theme }: FuelComparisonProps) {
  const isRtl = language === 'ar';
  const activeUser = CustodyDB.getActiveUser();
  const [iframeHeight, setIframeHeight] = useState<number>(650);

  useEffect(() => {
    // Log open audit event
    const activeUser = CustodyDB.getActiveUser();
    LogsModule.logAudit('FuelComparison', 'OPEN', {
      module: 'FuelComparison',
      action: 'OPEN',
      userId: activeUser?.id || 'system',
      companyId: activeUser?.company_id || 'comp-1',
      timestamp: new Date().toISOString()
    });

    return () => {
      // Log close audit event on unmount
      const activeUser = CustodyDB.getActiveUser();
      LogsModule.logAudit('FuelComparison', 'CLOSE', {
        module: 'FuelComparison',
        action: 'CLOSE',
        userId: activeUser?.id || 'system',
        companyId: activeUser?.company_id || 'comp-1',
        timestamp: new Date().toISOString()
      });
    };
  }, []);

  useEffect(() => {
    const calculateHeight = () => {
      const element = document.getElementById('fuel-comparison-frame');
      if (element) {
        const rect = element.getBoundingClientRect();
        // Calculate the remaining height to the bottom of the viewport
        // Subtract 16px for a clean bottom gap
        const remaining = window.innerHeight - rect.top;
        setIframeHeight(Math.max(450, remaining));
      }
    };

    // Calculate immediately on mount
    calculateHeight();

    // Set up resize observer on the parent container, or window resize listener
    window.addEventListener('resize', calculateHeight);

    // Also run with multiple delays to account for dynamic elements, transitions and rendering delays
    const timer1 = setTimeout(calculateHeight, 50);
    const timer2 = setTimeout(calculateHeight, 200);
    const timer3 = setTimeout(calculateHeight, 600);

    return () => {
      window.removeEventListener('resize', calculateHeight);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  if (!activeUser?.permissions?.view_reports) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center space-y-4">
        <div className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-sans tracking-tight">
          {isRtl ? 'غير مصرح بالوصول' : 'Access Denied'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed font-semibold">
          {isRtl 
            ? 'عذراً، لا تمتلك الصلاحيات الكافية لعرض هذه الشاشة.' 
            : 'Access restricted: You do not have permissions to view this screen.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      <iframe
        id="fuel-comparison-frame"
        src="/legacy/fuel-comparison/index.html"
        title="Fuel Comparison & Receipts Parser"
        className="w-full block border-none"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          display: 'block',
          border: 'none',
        }}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
