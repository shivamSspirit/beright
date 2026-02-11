'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import EmbedWidget from '@/components/EmbedWidget';
import { Loader2 } from 'lucide-react';

function EmbedContent() {
  const searchParams = useSearchParams();

  const marketId = searchParams.get('id') || undefined;
  const question = searchParams.get('q') || undefined;
  const platform = searchParams.get('platform') || 'polymarket';
  const theme = (searchParams.get('theme') as 'dark' | 'light') || 'dark';
  const showAI = searchParams.get('ai') !== 'false';
  const showConsensus = searchParams.get('consensus') !== 'false';
  const compact = searchParams.get('compact') === 'true';

  return (
    <div className={`min-h-screen p-4 ${theme === 'dark' ? 'bg-[#0a0a0f]' : 'bg-gray-50'}`}>
      <EmbedWidget
        marketId={marketId}
        question={question}
        platform={platform}
        showAI={showAI}
        showConsensus={showConsensus}
        theme={theme}
        compact={compact}
      />
    </div>
  );
}

export default function EmbedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    }>
      <EmbedContent />
    </Suspense>
  );
}
