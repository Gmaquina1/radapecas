# Radar Pecas

Prototipo de app web para buscar pecas por foto, codigo e dados da maquina/veiculo.

## Como testar

1. Abra `index.html` no navegador.
2. Clique em `Enviar ou tirar foto da peca`.
3. Envie uma foto do codigo, etiqueta, embalagem ou placa da peca.
4. Clique em `Ler codigo da foto`.
5. Confira o codigo sugerido e clique em `Montar buscas`.

## O que ja funciona

- Leitura de codigo por OCR no navegador usando Tesseract.js.
- Tentativa de leitura de codigo de barras quando o navegador suporta `BarcodeDetector`.
- Campo manual para corrigir codigo, marca, maquina, cidade e tipo da peca.
- Links de busca para Google, Google Shopping, Mercado Livre, OLX e Shopee.
- Busca tecnica por catalogo PDF/manual.
- Busca focada em peca usada/remanufaturada.
- Cadastro local de fornecedores alvo por dominio.
- Historico local das ultimas buscas.
- Botao para copiar mensagem de pedido para WhatsApp.

## Importante

Este prototipo abre buscas prontas na internet. Para ele procurar automaticamente em fornecedores e trazer resultados dentro da tela, a proxima versao precisa de um servidor/API para:

- consultar fornecedores cadastrados;
- salvar pedidos de busca;
- receber resposta de lojistas;
- integrar APIs de marketplaces;
- enviar alertas por WhatsApp ou e-mail;
- guardar fotos e historico em nuvem.

## Melhor uso

O melhor nicho para este app e peca de:

- maquina pesada;
- caminhao e linha diesel;
- trator e implemento;
- peca hidraulica;
- peca dificil de achar;
- item usado/remanufaturado.

Maquina parada da prejuizo. O valor do app esta em reduzir o tempo de procura.
