# Radar Pecas

Versao: v1.5.0-verificado

## Como testar

1. Abra `index.html`.
2. Clique em `Enviar ou tirar foto da peca`.
3. Envie foto do codigo, etiqueta, embalagem ou placa da peca.
4. Clique em `Reconhecer foto`.
5. Se o codigo nao aparecer, preencha codigo, nome da peca, marca ou maquina.
6. Clique em `Buscar peca`.

## O que funciona nesta versao

- Botao `Reconhecer foto`.
- Leitura de codigo por OCR no navegador.
- Segunda leitura automatica com contraste alto para melhorar codigo em etiqueta.
- Tentativa de leitura de codigo de barras quando o navegador suporta.
- Campos manuais para corrigir a busca.
- Consulta anuncios reais com preco e link.
- Peca usada e remanufaturada so aparecem quando houver anuncio compativel encontrado.
- Versao visivel na tela.
- Botao para copiar pedido de cotacao.

## Observacao

Sem backend e sem API paga, o HTML nao consegue identificar qualquer peca apenas pelo formato da foto com precisao profissional. O fluxo mais confiavel para teste e reconhecer codigo/etiqueta da peca e montar os links de compra automaticamente.
