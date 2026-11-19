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
| 1 | `node fisiotube/conteudo20-cli.js storyboard "<tema>" --query "<busca PubMed>"` | Cria o esqueleto do storyboard com as referências do `scientific-core` (PMID/DOI). |
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
`"camera_substituta": [[t0, t1, {"video": "broll/ex13.mp4", "inicio": 0, "rotulo": "Exercício 13"}]]` toca um vídeo de apoio (ex.: demonstração de exercício) nesses intervalos, inteiro em 16:9 sobre fundo desfocado; com um número no lugar do objeto, `[[t0, t1, t_quadro]]` no storyboard mostra, nesses intervalos, um quadro parado do apresentador (de `t_quadro`, escolhido numa pausa com boca fechada) com zoom lento — mantém a pessoa na tela quando o original corta para slides ou tem tarja.
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
| `prova` | Card de evidência (etiqueta, número, achado, PMID) em cima + vídeo embaixo | `clip`, `tag`, `numero`, `achado`, `fonte` (com `PMID n` presente em `references`), `encaixe` (vídeo 16:9 inteiro) |
| `icone` | Objeto pequeno em cima + vídeo embaixo, com legenda | `clip`, `kicker`, `icone`, `legendas` |
| `lista` | Lista da oferta: título e itens com check entrando um a um | `kicker`, `titulo`, `itens`, `ritmo` (s entre itens) |
| `preco` | Preço: selo, plano, valor "de" riscado, valor "por", parcelado e notas | `kicker`, `selo`, `plano`, `de`, `por`, `por_sub`, `parcelado`, `notas`, `fonte_preco` (onde e quando o preço foi conferido — obrigatório) |
| `final` | Palavras grandes (ex.: SALVA / ESSE VÍDEO, ou um site) + rodapé; encolhem para caber | `palavras`, `rodape` |

Comuns: `id`, `dur` (s), `revisado` (obrigatório para renderizar), `encaixe: true` em `hook`, `footage`, `icone` e `prova` para mostrar um vídeo horizontal inteiro sobre fundo desfocado. `clip` = `[arquivo na pasta, início em s]`; vídeos de celular na vertical são respeitados. Raiz: `trilha` = `gerada` (base original, sem direitos de terceiros), caminho de um áudio seu, ou `nenhuma`; `saida`; `references`.

```
node fisiotube/conteudo20-cli.js validate-v2 roteiro.json
node fisiotube/conteudo20-cli.js render-v2 <pasta> [roteiro.json]
```

`render-v2` recusa se faltar revisão humana, se uma `prova` não tiver PMID listado em `references` ou se um vídeo citado não estiver na pasta. Estilo: Montserrat ExtraBold (cai para Poppins se não houver), grafite #16151A–#201E22, cobre #D9773A. Exemplo: `exemplo/roteiro_v2.json`.
