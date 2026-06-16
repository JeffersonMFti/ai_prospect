# F07 — Mockup visual da LP + Enriquecimento + Booking

> O diferencial competitivo nº1 do produto: mandar na prospecção uma **prévia visual da landing page
> do próprio prospect**. Decisão: Gemini gera o **HTML real** → Playwright printa (Caminho B).
> Modelo do HTML: **configurável** via env `GEMINI_HTML_MODEL` — usar o **Gemini mais capaz disponível
> na conta** (padrão `gemini-2.5-pro`; se houver um modelo mais novo/3.x na conta, basta apontar o ID).
> Scoring/mensagem seguem no flash (barato). Trocar o modelo do HTML é 1 linha de config.

## Objetivo
Transformar a abordagem de *"posso te mostrar um esboço"* em *"fiz um rascunho da sua página, olha"* +
a **imagem do mockup**. Isso dispara a taxa de resposta e nenhum concorrente do nicho faz.

Posicionamento da amostra: o cliente precisa entender que é **só uma amostra feita rapidamente** para
ilustrar — a página final seria sob medida, com o **máximo de detalhe premium**. Isso valoriza o produto
em vez de entregá-lo de graça.

---

## Pipeline (Caminho B — HTML real → screenshot)

```
1. ENTRADA (dados do lead + enriquecimento):
   name, niche, city, rating, num_reviews, owner_name, photo_url, instagram

2. GEMINI 2.5 PRO (texto) -> gera HTML+CSS self-contained da landing page (prompt abaixo)

3. (OPCIONAL) GEMINI IMAGE (gemini-2.5-flash-image) -> foto de capa do nicho, se não houver foto real

4. PLAYWRIGHT (já temos) -> renderiza o HTML e tira screenshot:
   - viewport mobile (ex.: 430x.. full page) e/ou desktop
   - opcional: compõe num frame de iPhone ("seu site no celular")

5. SUPABASE STORAGE (bucket 'mockups') -> upload do PNG -> URL pública

6. ENTREGA:
   - Manual: card mostra o mockup + botão "baixar imagem" (anexa no WhatsApp na mão)
   - Auto (futuro): uazapi /send/media com a URL, junto da mensagem
```

Onde roda: no **agente local** (Python já tem Playwright). Um script `mockup.py` gera para os leads
`pronto`/`pontuado` que ainda não têm mockup, e grava `leads.mockup_url`.

---

## PROMPT DE GERAÇÃO DO HTML (gemini-2.5-pro) — reforçado

```
Você é um web designer e desenvolvedor sênior, especialista em landing pages de ALTA CONVERSÃO e
visual PREMIUM para pequenos negócios locais. Gere uma LANDING PAGE COMPLETA em HTML5 com CSS no
<style> (totalmente self-contained, pronta para renderizar em um print), como AMOSTRA personalizada
do negócio abaixo. O objetivo é IMPRESSIONAR o dono e fazê-lo querer a versão final.

NEGÓCIO:
- Nome: {name}
- Nicho: {niche}
- Cidade: {city}
- Avaliação: {rating} estrelas ({num_reviews} avaliações)
- Dono(a): {owner_name}
- Foto de capa (URL, opcional): {photo_url}

PADRÃO DE QUALIDADE (premium, mesmo sendo uma amostra):
- Mobile-first (referência 430px de largura), responsiva, sem quebrar layout.
- Design MODERNO e SOFISTICADO: hierarquia tipográfica forte, muito respiro (espaçamento),
  gradientes sutis, sombras suaves, cantos arredondados, microdetalhes de acabamento.
- Paleta COERENTE COM O NICHO:
  estética/beleza -> nude, rosé, dourado; advocacia -> navy, grafite, dourado;
  academia/fitness -> preto, energia (lima/laranja); saúde/odontologia -> verdes/azuis de confiança;
  gastronomia -> tons quentes e apetitosos. Escolha a melhor para o nicho informado.
- Tipografia via Google Fonts (link no <head>): um par elegante (ex.: 'Playfair Display' display +
  'Inter' corpo). Use pesos variados.
- SEÇÕES OBRIGATÓRIAS:
  1) Header fixo: nome do negócio (logotipo textual estilizado) + botão "Agendar".
  2) HERO de impacto: headline emocional e específica do nicho + subheadline + CTA primário
     "Agendar pelo WhatsApp". Use a foto de capa como background com overlay escuro p/ legibilidade;
     se não houver foto, use um gradiente rico do nicho.
  3) Barra de PROVA SOCIAL real: "★ {rating} · {num_reviews} avaliações de clientes reais".
  4) SERVIÇOS: 3 a 4 cards com ícone (SVG inline ou emoji), título e 1 linha — típicos do nicho.
  5) SOBRE / diferenciais: parágrafo curto, persuasivo, humano, citando a cidade.
  6) GALERIA: 4 a 6 blocos; sem fotos -> placeholders elegantes (gradiente + ícone), nunca vazio feio.
  7) DEPOIMENTO: 1 realista (marcado discretamente como ilustrativo).
  8) CTA FINAL forte (faixa destacada) + rodapé com nome, cidade e contato.
- COPY 100% em PT-BR, persuasiva e específica do nicho. PROIBIDO "Lorem ipsum" ou texto genérico.
- Selo discreto no rodapé/canto: "Amostra • rascunho" (deixa claro que é uma prévia).
- SEM JavaScript obrigatório. CSS todo no <style>. Imagens externas só a foto de capa (se houver).
- SAÍDA: SOMENTE o documento HTML completo, começando em <!doctype html>. Nada fora do HTML.
```

### Notas do gerador
- Temperatura ~0.8 (criatividade controlada). Validar que a saída começa com `<!doctype` / `<html`.
- Sanitizar: remover ```` ```html ```` se o modelo embrulhar em code fence.
- Fallback de foto: se `photo_url` ausente, instruir gradiente (já no prompt).

---

## Render (Playwright) — `agent/mockup.py`
- `browser.new_page(viewport={'width':430,'height':932}, device_scale_factor=2)`
- `page.set_content(html, wait_until='networkidle')` (espera Google Fonts/foto)
- `png = page.screenshot(full_page=True)` (mobile) — opcional desktop 1440px
- (Opcional) compor num frame de iPhone: PNG do frame por cima, ou CSS de "device frame".
- Upload no Supabase Storage (bucket `mockups`, público) via supabase-py storage.

---

## Mensagem que acompanha o mockup (positioning de amostra)
Adicionar ao prompt de mensagem (quando há mockup) algo como:
```
- Diga que você fez um RASCUNHO/AMOSTRA rápido só para ilustrar a ideia.
- Deixe claro que a versão final seria feita sob medida, com muito mais detalhe e capricho premium.
- Convide a opinar: "o que acha? posso deixar com a sua cara." Mantenha empático, sem pressão.
```
Ex.: *"Oi Daniela, fiz um rascunho rápido de como a página da sua clínica poderia ficar (em anexo).
É só uma amostra pra você ter uma ideia — a versão final seria sob medida, com muito mais detalhe.
O que achou?"*

---

## Enriquecimento (alimenta o mockup e a personalização)
Campos novos em `leads` (migration futura):
- `photo_url text` — foto principal do Google Maps (scraper pega no painel de detalhe).
- `owner_name text` — provável primeiro nome do dono (Gemini infere do nome do negócio).
- `instagram_handle text` — @ quando o Maps linka.
- `mockup_url text` — URL do PNG do mockup gerado.
- (futuro) sinais: `opening_hours`, `price_level`, p/ priorização no scoring.

Scraper: capturar `photo_url` (img principal) e `instagram_handle`.
Enrich: pedir ao Gemini o `owner_name` provável junto do scoring (ou passo dedicado).

---

## Booking (#6)
- `settings.booking_url text` — link de agenda (Calendly / Cal.com / Google Agenda).
- Tela de Configurações: campo para editar.
- Mensagem/closer: oferecer "se preferir, agende um horário: {booking_url}".
- PLUS: integração com Google Calendar (MCP disponível) — criar evento quando o lead agendar e
  refletir no card do CRM ("reunião marcada para ..."). MVP = só o link.

---

## Data model (migration 0006 — planejada)
```sql
alter table leads add column if not exists photo_url text;
alter table leads add column if not exists owner_name text;
alter table leads add column if not exists instagram_handle text;
alter table leads add column if not exists mockup_url text;
alter table settings add column if not exists booking_url text;
-- Storage: criar bucket público 'mockups'.
```

## Ordem de build sugerida
1. Enriquecimento mínimo (foto + owner_name) — necessário pro mockup.
2. `mockup.py`: HTML (Pro) → screenshot → storage → `leads.mockup_url`.
3. Exibir mockup no card (Aprovação/CRM) + botão baixar; ajustar mensagem (positioning amostra).
4. Booking: campo em settings + closer + (opcional) Google Calendar.

## Critérios de aceitação
- AC1: para um lead, gera um PNG de LP premium, personalizado (nome/nicho/avaliações reais), salvo e exibido no card.
- AC2: HTML válido, mobile-first, sem "Lorem ipsum", paleta coerente com o nicho.
- AC3: mensagem acompanha posicionando como amostra (sem pressão).
- AC4: booking_url configurável e aparece no fechamento.
