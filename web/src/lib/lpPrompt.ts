import type { Lead } from './types';

interface NicheCopy {
  publico: string;
  objetivo: string;
  dor: string;
  promessa: string;
  headline: string;
  tom: string;
  paleta: string;
  servicos: string;
}

const NICHE_COPY: Record<string, NicheCopy> = {
  estetica: {
    publico: 'mulheres que buscam autoestima, beleza e autocuidado',
    objetivo: 'gerar agendamentos de avaliação/procedimentos',
    dor: 'depende do Instagram/DM, perde clientes que pesquisam no Google e não acham um canal claro de agendar',
    promessa: 'uma vitrine profissional 24h com portfólio e agendamento fácil',
    headline: 'Sua beleza merece ser encontrada.',
    tom: 'acolhedor, sofisticado e confiável',
    paleta: 'nude, rosé e dourado (elegante e feminino)',
    servicos: 'limpeza de pele, harmonização, massagens, procedimentos estéticos',
  },
  saude: {
    publico: 'pacientes que valorizam confiança, segurança e facilidade de agendar',
    objetivo: 'gerar agendamentos de consulta',
    dor: 'sem site, transmite menos credibilidade e dificulta o agendamento',
    promessa: 'presença profissional que inspira confiança e facilita marcar consulta',
    headline: 'Cuidado que inspira confiança.',
    tom: 'sério, acolhedor e profissional',
    paleta: 'verdes e azuis de confiança, com branco clean',
    servicos: 'consultas, tratamentos, exames, especialidades',
  },
  advocacia: {
    publico: 'pessoas e empresas que precisam de orientação jurídica confiável',
    objetivo: 'gerar contatos para consulta',
    dor: 'sem site, perde autoridade e clientes para escritórios mais estabelecidos online',
    promessa: 'autoridade e discrição que transmitem segurança jurídica',
    headline: 'Seus direitos em mãos experientes.',
    tom: 'formal, sóbrio e confiável',
    paleta: 'navy, grafite e dourado (autoridade)',
    servicos: 'áreas de atuação, consultoria, atendimento',
  },
  academia: {
    publico: 'pessoas em busca de saúde, resultado e mudança de vida',
    objetivo: 'gerar matrículas/aulas experimentais',
    dor: 'sem site, perde alunos que pesquisam academias na região',
    promessa: 'energia e prova de resultado que motivam a começar hoje',
    headline: 'Comece hoje. Resultado de verdade.',
    tom: 'energético, motivador e direto',
    paleta: 'preto com acento vibrante (lima ou laranja)',
    servicos: 'modalidades, planos, aula experimental, estrutura',
  },
  gastronomia: {
    publico: 'clientes com fome de uma boa experiência, delivery ou reserva',
    objetivo: 'gerar pedidos/reservas',
    dor: 'depende de apps caros e do Instagram, sem canal próprio de pedido/reserva',
    promessa: 'um cardápio apetitoso com pedido/reserva direto, sem comissão de app',
    headline: 'Dá água na boca — e agora também online.',
    tom: 'quente, convidativo e saboroso',
    paleta: 'tons quentes e apetitosos (vinho, mostarda, madeira)',
    servicos: 'cardápio, delivery, reservas, especialidades da casa',
  },
  default: {
    publico: 'clientes da região que pesquisam por esse serviço online',
    objetivo: 'gerar contatos e agendamentos',
    dor: 'depende só do Instagram, não aparece no Google e perde clientes para concorrentes com site',
    promessa: 'uma presença profissional que atrai e converte clientes',
    headline: 'O seu negócio, encontrado por quem procura.',
    tom: 'profissional, próximo e confiável',
    paleta: 'moderna e coerente com a identidade do negócio',
    servicos: 'principais serviços do negócio',
  },
};

function detectNiche(niche: string | null): NicheCopy {
  const n = (niche ?? '').toLowerCase();
  if (/estét|beleza|harmoniz|cílios|sobrancelha|spa|massag/.test(n)) return NICHE_COPY.estetica;
  if (/odonto|dent|clínic|saúde|fisio|nutri|psico|médic/.test(n)) return NICHE_COPY.saude;
  if (/advog|jurídic|direito/.test(n)) return NICHE_COPY.advocacia;
  if (/academ|fitness|crossfit|pilates|treino|gym/.test(n)) return NICHE_COPY.academia;
  if (/restaur|lanch|pizz|food|gastro|bar|cafe|hambúrg|açaí/.test(n)) return NICHE_COPY.gastronomia;
  return NICHE_COPY.default;
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'cliente'
  );
}

/** Monta um prompt profissional e completo para construir a LP no Claude Code. */
export function buildLpPrompt(lead: Lead): string {
  const niche = lead.niche ?? 'negócio local';
  const c = detectNiche(lead.niche);
  const wa = lead.phone ? `https://wa.me/${lead.phone}` : '(inserir o WhatsApp)';
  const photos = (lead as Lead & { photos?: string[] }).photos;
  const ownerName = (lead as Lead & { owner_name?: string }).owner_name;
  const slug = slugify(lead.name);

  const linhas: string[] = [
    `# Tarefa: criar uma LANDING PAGE PREMIUM para "${lead.name}"`,
    ``,
    `📁 LOCAL DO ARQUIVO: crie a página em \`clientes/${slug}/index.html\` (crie a pasta se não existir).`,
    `   NUNCA crie na raiz do projeto. Tudo dessa LP fica dentro de \`clientes/${slug}/\`.`,
    ``,
    `Você é o Claude Code (Opus 4.8) — capriche no nível máximo. Construa uma landing page de`,
    `ALTÍSSIMO nível (visual premium + alta conversão) em UM ÚNICO arquivo \`index.html\`, 100%`,
    `self-contained: TODO o CSS e JS dentro do próprio arquivo (tags <style>/<script>). SEM build,`,
    `SEM npm, SEM servidor, SEM dependências/CDN obrigatórios. O cliente precisa abrir o arquivo com`,
    `DUPLO CLIQUE, direto no navegador, e ver a página perfeita — inclusive sem internet.`,
    `Fontes do Google podem entrar via <link> (com fallback para fonte do sistema se offline).`,
    ``,
    `## O negócio`,
    `- Nome: ${lead.name}`,
    `- Nicho: ${niche}`,
    `- Cidade/Região: ${lead.address ?? '—'}`,
    `- Avaliação: ${lead.rating ?? '—'} estrelas (${lead.num_reviews ?? 0} avaliações REAIS — use como prova social)`,
    `- WhatsApp (CTA): ${wa}`,
    lead.instagram_url ? `- Instagram: ${lead.instagram_url}` : `- Instagram: —`,
    ownerName ? `- Responsável: ${ownerName}` : ``,
    photos && photos.length
      ? `- Fotos da marca (use no hero e na galeria):\n${photos.map((u) => `  - ${u}`).join('\n')}`
      : `- Fotos: não disponíveis — use placeholders elegantes (gradiente + ícone), nunca vazio feio`,
    ``,
    `## Público e objetivo`,
    `- Público: ${c.publico}`,
    `- Objetivo da página: ${c.objetivo}`,
    ``,
    `## Direção de copy (ângulo do nicho)`,
    `- Dor do cliente: ${c.dor}`,
    `- Promessa: ${c.promessa}`,
    `- Headline sugerida (pode melhorar): "${c.headline}"`,
    `- Tom: ${c.tom}`,
    ``,
    `## Design (premium)`,
    `- Paleta: ${c.paleta}`,
    `- Tipografia: par elegante via Google Fonts (um display + um de corpo)`,
    `- Muito respiro, gradientes sutis, sombras suaves, cantos arredondados, microdetalhes de acabamento`,
    `- Mobile-first e totalmente responsiva`,
    ``,
    `## Seções obrigatórias`,
    `1. Header fixo: logo textual estilizado + botão "Agendar"`,
    `2. Hero de impacto: headline + subheadline + CTA "Agendar pelo WhatsApp" + imagem de capa`,
    `3. Barra de prova social: "★ ${lead.rating ?? ''} · ${lead.num_reviews ?? 0} avaliações de clientes"`,
    `4. Serviços: 3-4 cards (${c.servicos})`,
    `5. Sobre/diferenciais: texto curto e persuasivo citando ${lead.address ?? 'a cidade'}`,
    `6. Galeria: 4-6 blocos (fotos da marca ou placeholders elegantes)`,
    `7. Depoimento (1, realista)`,
    `8. CTA final forte + rodapé com nome, contato e localização`,
    ``,
    `## Vá ALÉM — recursos avançados (você é o Opus 4.8, mostre nível)`,
    `- Animações de revelar ao rolar (IntersectionObserver), suaves e elegantes.`,
    `- Header fixo que ganha blur/encolhe ao rolar; menu mobile (hambúrguer); smooth scroll nas âncoras.`,
    `- Botão FLUTUANTE de WhatsApp (canto inferior direito), discreto e com leve pulso.`,
    `- Hero com fundo sutilmente animado (gradiente em movimento ou brilho/formas em CSS puro).`,
    `- Contadores que animam de 0 (ex.: ${lead.num_reviews ?? 'N'}+ clientes satisfeitos).`,
    `- Carrossel de depoimentos e galeria com lightbox (clicar para ampliar).`,
    `- FAQ em accordion. Microinterações em botões e cards (hover/active/foco).`,
    `- SEO: <title>, meta description, Open Graph, lang="pt-BR", favicon (emoji via data URI).`,
    `- JSON-LD schema.org "LocalBusiness" (nome, telefone, aggregateRating ${lead.rating ?? ''} com ${lead.num_reviews ?? 0} avaliações, cidade).`,
    `- Acessibilidade (alt, contraste AA, foco visível) e performance (imagens lazy, zero libs pesadas).`,
    `- TUDO em HTML + CSS + vanilla JS embutidos (sem frameworks/bundler), para manter o arquivo único.`,
    ``,
    `## Regras`,
    `- Copy 100% em PT-BR, persuasiva e específica do nicho. PROIBIDO "Lorem ipsum".`,
    `- Todos os CTAs levam ao WhatsApp: ${wa}`,
    `- Salve em \`clientes/${slug}/index.html\` (nunca na raiz). UM ÚNICO arquivo, CSS+JS embutidos,`,
    `  sem dependências obrigatórias, que abra perfeitamente com DUPLO CLIQUE. Acabamento premium.`,
    `- Ao terminar, me diga o caminho do arquivo para eu abrir.`,
  ];

  return linhas.filter((l) => l !== undefined).join('\n');
}
