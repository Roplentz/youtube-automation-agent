# Modo VSL
Execute a partir da raiz do projeto com Node 18.17+, dependências instaladas e FFmpeg com drawtext e libx264 no PATH.

1. Edite scripts/vsl/eletropilates.json com os fatos da oferta. Configure o provedor de texto usado por AITextService no ambiente.
2. Gere um plano com duas aberturas e um corpo compartilhado:
   `node scripts/vsl/vsl.js roteiro scripts/vsl/eletropilates.json plano.json`
3. Revise as falas, a CTA e os materiais indicados em visual. Para experimentar sem credenciais, use o plano editorial de exemplo abaixo.
4. Gere a prévia de leitura:
   `node scripts/vsl/vsl.js render scripts/vsl/piloto.json A previa-A.mp4 preview`
5. Para narrar com a voz selecionada, configure ELEVENLABS_API_KEY e ELEVENLABS_VOICE_ID no ambiente e substitua preview por voz, usando um novo destino. Cada cena faz uma chamada tarifável. Troque A por B para a segunda abertura.

A montagem atual produz cartelas horizontais com texto. O campo visual orienta a edição posterior com imagens reais. A prévia é silenciosa e usa duração estimada de leitura. O modo voz acompanha a duração do áudio de cada cena. Revise a fala e a legibilidade antes de usar o vídeo. A ferramenta só grava arquivos locais e exige destinos novos.
