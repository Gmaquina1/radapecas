# Radar Pecas

Versao: v2.0.1-diagnostico

## Como testar

1. Instale Node.js 20 ou superior.
2. Copie `.env.example` para `.env`.
3. Coloque sua chave em `OPENAI_API_KEY`.
4. Rode `npm start`.
5. Abra `http://localhost:3000` no computador ou no celular pela mesma rede.
6. Clique em `Tirar foto` ou `Galeria`.
7. Clique em `Reconhecer com IA`.

Sem `OPENAI_API_KEY`, a tela ainda abre, mas usa apenas a leitura local por codigo/OCR.

## O que funciona nesta versao

- Botao `Reconhecer com IA`.
- Backend `server.js` com IA de visao real.
- Chave da IA protegida no servidor, fora do HTML.
- Acesso separado para camera e galeria do celular.
- Busca geral para pecas automotivas, moto, maquina, eletrodomestico, industrial, hidraulica, eletrica e eletronica.
- Campo de segmento para direcionar melhor a busca.
- Leitura de codigo por OCR no navegador.
- Segunda leitura automatica com contraste alto para melhorar codigo em etiqueta.
- Tentativa de leitura de codigo de barras quando o navegador suporta.
- Campos manuais para corrigir a busca.
- Consulta anuncios reais com preco e link.
- Peca usada e remanufaturada so aparecem quando houver anuncio compativel encontrado.
- Versao visivel na tela.
- Botao para copiar pedido de cotacao.

## Variaveis

- `OPENAI_API_KEY`: chave da OpenAI.
- `OPENAI_MODEL`: modelo de visao. Padrao: `gpt-5.5`.
- `PORT`: porta local. Padrao: `3000`.

## Observacao

A IA identifica a peca pela foto, mas resultados de compra continuam sendo confirmados por anuncios com preco e link. Usada e remanufaturada so aparecem quando houver sinal real no anuncio.
