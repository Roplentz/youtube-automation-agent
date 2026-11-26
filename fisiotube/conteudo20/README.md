# FisioTube — Conteúdo 2.0 (experimental)

Vídeo vertical 1080x1920 em que **o apresentador fala e a explicação vai sendo montada na tela em tempo real**: painéis animados disparados por palavras-gatilho da fala, legenda palavra a palavra, gancho e CTA.

Tudo é **local e manual**: nada é publicado, nenhuma API paga é chamada e nenhum vídeo é renderizado sem revisão humana de cada cena.

## Fluxo

```
tema ──(PubMed opcional)──▶ storyboard.json ──revisão humana──▶ gravação
                                                                   │
                     MP4 (rascunho) ◀── render ◀── cenas.json ◀── sync ◀── words.json (transcrição local)
```

| Etapa | Comando | O que faz |
|---|---|---|
| 1 | `node fisiotube/conteudo20-cli.js storyboard "<tema>" --query "<busca PubMed>" [--desde 2015] [--ate 2026] [--tipos ecr,revisao_sistematica]` | Cria o esqueleto do storyboard com as referências do `scientific-core` (PMID, DOI, ano, revista e desenho do estudo). Tipos aceitos: `metanalise`, `revisao_sistematica`, `ecr`, `ensaio_clinico`, `diretriz`, `revisao`. |
| 2 | (humano ou skill de roteiro) | Preenche `cenas[]`: fala, gatilhos, layout, modelo, `claims` com PMIDs. Marca `revisado: true` cena a cena. |
| 3 | `node fisiotube/conteudo20-cli.js validate storyboard.json` | Valida contrato, travas de segurança e fontes das afirmações. |
| 4 | `node fisiotube/conteudo20-cli.js transcribe gravacao.mp4 words.json` | Transcrição palavra a palavra com faster-whisper (local). |
| 5 | `node fisiotube/conteudo20-cli.js sync storyboard.json words.json --inicio 5 --fim 61.3 --cx 960 [--sem-camera 8.6-19.2]` | Localiza cada gatilho na fala e gera `cenas.json`. Gatilhos não encontrados são **reportados** (exit 3), nunca inventados. |
| 6 | `node fisiotube/conteudo20-cli.js render <pasta>` | Recusa se houver cena não revisada ou afirmação sem fonte; senão renderiza o rascunho MP4. |

A pasta do passo 6 precisa conter `storyboard.json`, `cenas.json`, `words.json` e o vídeo-fonte (`fonte.arquivo`).

## Storyboard (contrato)

```json
{
 "titulo": "...", "slug": "...", "formato": "reel|vsl", "duracao_alvo": 55,
 "status": "DRAFT_REVIEW_REQUIRED", "scientificReviewRequired": true, "publishingEnabled": false,
 "gancho": {"titulo": ["LINHA 1", "linha 2", "linha 3"], "kicker": "MARCA"},
 "cenas": [{
   "id": "C1", "layout": "split|full|cam", "modelo": "osciloscopio|forca_fadiga|cartao",
   "fala": "texto do teleprompter",
   "gatilhos": [{"palavra": "10 Hz", "acao": {"keyframe_hz": 10}}],
   "claims": [{"text": "afirmação mostrada", "pmids": ["123"]}],
   "params": {"titulo": "parâmetros estáticos do modelo"},
   "revisado": false
 }],
 "cta": {"linha1": "...", "destaque": "...", "linha2": "...", "rodape": "..."},
 "destaques": ["termos em laranja na legenda"], "correcoes_previstas": {"erro": "correção"},
 "references": [{"pmid": "123", "doi": "...", "title": "...", "url": "..."}]
}
```

Ações de gatilho: `keyframe_hz`, `rotulo` (`[título, subtítulo]`), `chip`, `chips_fim`, `evento` (`freq_sobe|forca|fadiga`), `item` (modelo `cartao`).
Cenas consecutivas do mesmo modelo viram um bloco contínuo; `"novo_bloco": true` abre outro bloco (ex.: dois cartões seguidos). `osciloscopio` e `forca_fadiga` só podem aparecer uma vez por vídeo.
Correções de legenda: `correcoes_previstas` aceita `"palavra"` (global) ou `"palavra@tempo"` (só aquela ocorrência, tempo da transcrição); valor vazio remove a palavra.
`"camera_substituta": [[t0, t1, {"video": "broll/ex13.mp4", "inicio": 0, "rotulo": "Exercício 13", "transicao": 0.3}]]` toca um vídeo de apoio, com fusão de entrada e saída (`transicao`, em segundos; 0 desliga), zoom lento e rótulo que desliza, (ex.: demonstração de exercício) nesses intervalos, inteiro em 16:9 sobre fundo desfocado; com um número no lugar do objeto, `[[t0, t1, t_quadro]]` no storyboard mostra, nesses intervalos, um quadro parado do apresentador (de `t_quadro`, escolhido numa pausa com boca fechada) com zoom lento — mantém a pessoa na tela quando o original corta para slides ou tem tarja.
Gancho com `"fundo": "desfocado"` desfoca o vídeo atrás do título (útil quando há tarja ou marca no início da gravação).
`layout: "full"` e `--sem-camera` (trechos sem apresentador, como slides) mostram o painel em tela cheia.

## Modelos de cena (`render/render.py`)

- `osciloscopio` — pulsos elétricos + curva de tensão muscular **calculada** (somação de abalos → tetania conforme a frequência).
- `forca_fadiga` — frequência sobe; barras de força e fadiga.
- `equacao` — "A + B = resultado"; eventos `a`, `b`, `resultado`; parâmetros `kicker`, `a`, `b`, `resultado`.
- `numero` — número grande que conta até `valor` a partir do evento `conta`; `prefixo`, `unidade`, `rotulo`, itens.
- `cartao` — genérico: kicker, título, itens que entram no tempo da fala e rodapé com a fonte (`Fonte: PMID …`, preenchido a partir de `claims`).
- `gancho` e `cta` — abertura e fechamento. No `cta`, `botao` troca o texto do botão (padrão "Salvar vídeo", com seta) e um `destaque` longo, como um site, encolhe para caber.

Novo modelo: escreva `draw_<nome>(img, t, box, full, s)` em `render.py`, registre em `DRAW` e em `MODELOS` (`storyboard.js`).

## Requisitos locais

- Node.js 18+ (sem dependências npm novas).
- Python 3.10+ e `pip install -r fisiotube/conteudo20/render/requirements.txt`.
- `ffmpeg` no PATH.
- Fonte Poppins (Bold/Medium) instalada, ou `CONTEUDO20_FONT_DIR` apontando para a pasta com os `.ttf`.
- Fonte de vídeo 1920x1080 com o apresentador centralizado (`--cx` ajusta o centro horizontal).

## Limites

- A transcrição pode errar termos técnicos: revise `correcoes_previstas`.
- Ligar um PMID a uma afirmação **não** prova que o estudo a sustenta; a revisão científica humana continua obrigatória.
- O vídeo gerado é rascunho; publicação continua fora deste módulo.
- O exemplo em `exemplo/` usa texto original e tempos sintéticos (só para testes).

Testes: `npm run test:fisiotube`.

## Formato v2 — 6 tipos de tela alternados

Para Reels sem narração sincronizada (ou com vídeos de prática/demonstração), o roteiro v2 descreve o vídeo cena a cena, cada uma com sua duração, alternando tipos de tela para manter o ritmo (troca a cada 2,5–4 s, nunca dois tipos iguais seguidos).

| `tipo` | Tela | Campos |
|---|---|---|
| `hook` | Vídeo em tela cheia + caixa-manchete (palavra-chave em amarelo) | `clip`, `caixa` (linhas), `chave` |
| `footage` | Vídeo em tela cheia + legenda revelada palavra por palavra | `clip`, `legendas` `[[t, texto, [chaves]]]` |
| `kinetic` | Tipografia grande em fundo escuro, palavra por palavra | `texto`, `chave` |
| `objeto` | Card com moldura cobre, título espaçado e objeto animado (órbita + partículas) | `kicker`, `icone` (`exo`, `bolt`, `sensor`, `escudo`), `legenda`, `chave` |
| `prova` | Card de evidência (selo de nível, etiqueta, número, achado, PMID) em cima + vídeo embaixo | `clip`, `tag`, `numero`, `achado`, `fonte` (com `PMID n` presente em `references`), `encaixe` (vídeo 16:9 inteiro), `nivel` (A–D, opcional, sobrescreve o selo), `ressalva` (linha de cautela; pedida quando o nível é D) |
| `icone` | Objeto pequeno em cima + vídeo embaixo, com legenda | `clip`, `kicker`, `icone`, `legendas` |
| `lista` | Lista da oferta: título e itens com check entrando um a um | `kicker`, `titulo`, `itens`, `ritmo` (s entre itens) |
| `preco` | Preço: selo, plano, valor "de" riscado, valor "por", parcelado e notas | `kicker`, `selo`, `plano`, `de`, `por`, `por_sub`, `parcelado`, `notas`, `fonte_preco` (onde e quando o preço foi conferido — obrigatório) |
| `dados` | Card cheio com gráfico: `icones` (matriz de pessoas, com ou sem grupo de comparação), `efeito` (estimativa com IC 95% e linha de nulidade, escala log para RR/OR/HR) ou `antes_depois` (barras com a diferença calculada) | `grafico`, `titulo`, `fonte` (com PMID), `tag`, `achado`, `ressalva`, `nivel`; `icones`: `valor`, `total` (10–100), `unidade_texto`, `rotulo`, `comparacao: {valor, rotulo}`; `efeito`: `estimativa`, `ic`, `medida`, `nulo`, `escala_log`, `escala`, `lados`; `antes_depois`: `antes`, `depois`, `unidade`, `rotulos` |
| `final` | Palavras grandes (ex.: MANDA PRA / UM COLEGA, ou um site) + rodapé; encolhem para caber | `palavras`, `rodape` |

Comuns: `id`, `dur` (s), `revisado` (obrigatório para renderizar), `encaixe: true` em `hook`, `footage`, `icone` e `prova` para mostrar um vídeo horizontal inteiro sobre fundo desfocado. `clip` = `[arquivo na pasta, início em s]`; vídeos de celular na vertical são respeitados. Raiz: `trilha` = `gerada` (base original, sem direitos de terceiros), caminho de um áudio seu, ou `nenhuma`; `saida`; `references`.

```
node fisiotube/conteudo20-cli.js referencias roteiro.json   # preenche references a partir dos PMIDs citados
node fisiotube/conteudo20-cli.js conferir roteiro.json      # folha conferencia.md: card × resumo do estudo
node fisiotube/conteudo20-cli.js cards <pasta> [roteiro.json]   # só os cards em HTML, para conferir o visual
node fisiotube/conteudo20-cli.js validate-v2 roteiro.json
node fisiotube/conteudo20-cli.js render-v2 <pasta> [roteiro.json]
```

`referencias` busca no PubMed os PMIDs das `references` e das `fonte` das cenas `prova`, grava título, DOI, ano, revista e desenho, mantém campos escritos à mão (ex.: notas do revisor), avisa sobre desenhos fracos (relato de caso, revisão narrativa) e sai com código 3 se algum PMID não existir. O desenho vem da classificação do PubMed: é uma pista para o revisor, não uma avaliação de qualidade.

`render-v2` recusa se faltar revisão humana, se uma `prova` não tiver PMID listado em `references` ou se um vídeo citado não estiver na pasta. Estilo: Montserrat ExtraBold (cai para Poppins se não houver), grafite #16151A–#201E22, cobre #D9773A. Exemplo: `exemplo/roteiro_v2.json`.

## Travas no render em Python

`render.py` e `render_v2.py` repetem a trava do CLI (`render/gate.py`): um render completo chamado direto pelo Python também recusa cenas sem `revisado: true`, `prova` ou afirmação sem PMID em `references` e `publishingEnabled` diferente de `false`. Prévias de quadros continuam liberadas para ajudar na revisão.

## PubMed (NCBI)

As buscas respeitam o limite da NCBI (3 requisições/s; 10/s com chave). Opcional no `.env`: `NCBI_API_KEY` e `NCBI_EMAIL`.

## Testes

`npm run test:fisiotube` roda os testes em Node e em Python; o CI roda esse job em todo push para `feature/**`, `fix/**` e `master` e em todo pull request.

## Nível de evidência no card

`referencias` grava em cada referência `nivel_desenho`, um nível A–D tirado do desenho do estudo: **A** metanálise, revisão sistemática ou diretriz; **B** ensaio clínico (randomizado ou não); **C** observacional; **D** relato de caso, revisão narrativa ou outro. O card de `prova` mostra o selo (ex.: `● EVIDÊNCIA FORTE · METANÁLISE 2024`) na cor do nível; com vários PMIDs, vale o mais forte.

É um ponto de partida, não GRADE: o revisor pode rebaixar ou elevar com `nivel` (e `nivel_motivo`) na referência ou `nivel` na cena, por exemplo quando a revisão sistemática tem risco de viés alto ou a amostra é pequena. Nível D gera aviso até a cena ter `ressalva`.

`conferir` gera `conferencia.md` com cada card ao lado do resumo de cada estudo citado e uma checklist (o resumo sustenta o número? o achado? a força da frase combina com o nível?). Dá para colar essa folha numa conversa com o Claude para uma segunda leitura; a decisão continua humana.

## Regras de retenção (avisos do `validate-v2`)

O Reels ranqueia primeiro por tempo assistido e conclusão, depois por envios por alcance e por curtidas por alcance. O validador avisa quando:

- o vídeo não abre com `hook` ou o gancho passa de 3 s;
- o total passa de 60 s;
- o vídeo não fecha com `final` ou a CTA não pede envio (`MANDA`, `ENVIE`, `COMPARTILHE`, `MARQUE`).

São avisos, não erros: o render continua liberado.

## Cards em HTML e design system

`prova` e `dados` são desenhados em HTML/CSS (`cards/templates.js`) e fotografados quadro a quadro pelo Playwright em `<pasta>/_cards/<id>/` (PNG transparente). `render-v2` gera os cards antes do vídeo e reaproveita os que não mudaram; o último PNG de cada pasta é o card completo. Requer o Chromium do Playwright (`npx playwright install chromium`). Sem ele, `prova` volta ao desenho antigo em Pillow e `dados` recusa; `--sem-html` força o desenho antigo.

Cores, fontes, raios, espaços e movimento ficam em `fisiotube/design/tokens.json`, lido pelos cards e pelo `render_v2.py`. As cores de nível (A verde, B azul, C âmbar, D vermelho) são reservadas para evidência. Títulos em Montserrat, textos e números em Inter (tabulares); fontes em `render/fonts` ou `CONTEUDO20_FONT_DIR` são carregadas também nos cards.

Os números dos gráficos vêm do estudo e entram na `conferencia.md`; a diferença do `antes_depois` é calculada, nunca digitada. `exemplo/roteiro_v2.json` traz um `efeito` com os dados reais da revisão Cochrane (OR 1,65; IC 95% 1,21 a 2,25); `exemplo/dados_ilustrativo.json` mostra os três gráficos com números fictícios, só para layout.

## Reel com avatar (voz e imagem clonadas)

Fluxo usado no exemplo `exemplo/ozempic/` (Ozempic, massa magra e EECI):

1. **Roteiro e storyboard** como de costume (`storyboard`, `referencias`, `validate`), com `claims` e PMIDs.
2. **Voz:** o teleprompter vira áudio com a voz clonada do autor no ElevenLabs.
3. **Imagem:** uma foto 16:9 da cabeça aos ombros, recortada da foto original sem fundo inventado por IA. Só o centro aparece no Reel; as laterais podem ser desfocadas. Anote o centro do rosto para o `--cx` do `sync`.
4. **Avatar:** foto + áudio viram o vídeo falado (HeyGen Avatar 6; o turbo custa metade). Esse vídeo entra como `src.mp4`.
5. **Transcrição e correção:** `transcribe` e depois `corrigir <storyboard.json> <words.json>`. O comando junta o que o Whisper quebra ("meta" + "-análise" = "metanálise", "35" + "%") e aplica `correcoes_transcricao` do storyboard (`{"o zempique": "Ozempic", "aquilo@2.82": "quilo"}`; várias palavras viram uma; `@tempo` limita à ocorrência perto daquele segundo). O original fica em `words_bruto.json`. O `sync` aplica as mesmas correções em memória antes de procurar os gatilhos.
6. **Vídeo de apoio:** `camera_substituta` troca o apresentador por exercícios nas falas correspondentes, com fusão, zoom lento e rótulo. Prefira gravações próprias (aqui, o Exercício 49 do curso Eletropilates). Clipes gerados por IA levam "ilustração (IA)" no rótulo.
7. **Revisão e render:** prévias de quadros, revisão humana (`revisado: true`) e `render`.

Ao publicar, ative o rótulo de conteúdo feito com IA da plataforma. Confirme o direito de imagem de quem aparece nos vídeos de apoio.
