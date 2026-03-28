import { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdSenseUnitProps = {
  slot?: string;
  title?: string;
  description?: string;
  minHeight?: number;
  format?: 'auto' | 'fluid';
  layoutKey?: string;
};

const ADSENSE_CLIENT = 'ca-pub-5318030852303688';

export default function AdSenseUnit({
  slot,
  title = 'Espaço patrocinado',
  description = 'Publicidade exibida pelo Google AdSense.',
  minHeight = 120,
  format = 'auto',
  layoutKey,
}: AdSenseUnitProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const normalizedSlot = slot?.trim();

  const canRenderAd = useMemo(() => Boolean(normalizedSlot), [normalizedSlot]);

  useEffect(() => {
    if (!canRenderAd || !adRef.current) return;
    if (adRef.current.getAttribute('data-adsbygoogle-status')) return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Falha silenciosa para não quebrar a interface caso o script ainda não tenha carregado.
    }
  }, [canRenderAd]);

  return (
    <div className="glass-card overflow-hidden border border-border/60">
      <div className="flex items-center justify-between gap-3 border-b border-border/50 bg-secondary/40 px-4 py-2.5">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
          Ads
        </span>
      </div>

      <div className="p-3">
        {canRenderAd ? (
          <ins
            ref={adRef}
            className="adsbygoogle block overflow-hidden rounded-xl"
            style={{ display: 'block', minHeight }}
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={normalizedSlot}
            data-ad-format={format}
            data-ad-layout-key={layoutKey}
            data-full-width-responsive="true"
          />
        ) : (
          <div
            className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/30 px-4 text-center"
            style={{ minHeight }}
          >
            <div className="space-y-1">
              <p className="text-sm font-medium">Bloco visual de anúncio pronto</p>
              <p className="text-[11px] text-muted-foreground">
                Falta configurar o slot do AdSense para este espaço começar a carregar anúncios reais.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
