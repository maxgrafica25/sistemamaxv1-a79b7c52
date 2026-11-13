// Arte "como colocar o cartão na impressora para imprimir o verso" (Fargo C50, uma face por vez).

function Cartao({ x, y, cor, rotulo, girado = false }: { x: number; y: number; cor: string; rotulo: string; girado?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) ${girado ? "rotate(180 28 40)" : ""}`}>
      <rect width="56" height="80" rx="6" fill={cor} stroke="#0f172a" strokeOpacity="0.25" strokeWidth="1.5" />
      <rect x="4" y="4" width="9" height="9" rx="1.5" fill="#0f172a" />
      <path d="M28 8 l-7 10 h4.5 v8 h5 v-8 h4.5 z" fill="#fff" fillOpacity="0.95" />
      <text x="28" y="52" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" transform={girado ? "rotate(180 28 52)" : ""}>
        {rotulo}
      </text>
    </g>
  );
}

function Seta({ d }: { d: string }) {
  return <path d={d} fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#ponta)" />;
}

export function CrachaVersoGuia() {
  return (
    <figure className="rounded-2xl bg-muted/40 p-4">
      <svg viewBox="0 0 560 150" role="img" aria-label="Passo a passo para imprimir o verso do cartão" className="w-full">
        <defs>
          <marker id="ponta" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#64748b" />
          </marker>
        </defs>
        <g fontSize="11" fill="#475569" fontWeight="600" textAnchor="middle">
          <text x="60" y="16">1. Imprima a frente</text>
          <text x="280" y="16">2. Vire o cartão</text>
          <text x="500" y="16">3. Imprima o verso</text>
        </g>
        <Cartao x={32} y={32} cor="#1d4ed8" rotulo="FRENTE" />
        <Seta d="M104 72 C132 72 148 72 168 72" />
        <Cartao x={252} y={32} cor="#1d4ed8" rotulo="FRENTE" />
        <path d="M232 36 C262 6 298 6 328 36" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#ponta)" />
        <Seta d="M336 72 C364 72 380 72 400 72" />
        <Cartao x={472} y={32} cor="#b91c1c" rotulo="VERSO" />
      </svg>
      <figcaption className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p>
          <span className="font-medium text-foreground">Como virar:</span> como uma página de livro, pela borda do lado. O <span className="font-medium text-foreground">topo continua no mesmo lugar</span> (a seta branca e o quadrado preto ficam em cima).
        </p>
        <p>A posição certa depende de como o cartão entra na sua Fargo C50. Por isso, antes do lote, imprima o <span className="font-medium text-foreground">cartão de teste</span> (botão abaixo): se o verso sair de cabeça para baixo em relação à frente, ligue "Girar o verso 180°".</p>
      </figcaption>
    </figure>
  );
}
