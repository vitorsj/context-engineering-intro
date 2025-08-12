## FEATURE:

Lawyerless — Explicador de Contratos de Investimento (pt-BR, MVP)

Escopo: Frontend que recebe PDFs digitais de instrumentos de investimento (Mútuo Conversível, SAFE, Term Sheet, Acordo de Acionistas/Quotistas e side letters) e exibe o contrato à esquerda e, cláusula a cláusula, um painel à direita com:

TL;DR (1–2 frases)

Explicação em linguagem simples (leigo adulto)

Por que importa / impacto prático

Bandeira (Verde/Amarelo/Vermelho) + motivo

Sugestões de perguntas de negociação

Público-alvo: leigos adultos (fundadores/PMEs/B2E) que precisam entender rapidamente documentos de investimento em pt-BR (jurisdição Brasil).

Entrada: somente PDFs digitais (sem OCR), sem limite de páginas/tamanho.

Saída/Exportação: foco on-screen (sem exportar nem integrar Notion/e-mail/e-signature no MVP).

Conhecimento do LLM: combina texto do contrato + conhecimento jurídico geral para explicar termos (ex.: Tag Along, Drag Along, Anti-diluição, Valuation Cap), deixando claro quando a explicação é geral versus quando é específica do contrato.

Ficha do contrato (resumo estruturado): extração automática para um “cartão” no topo da página (também usado para gerar bandeiras). Ver esquema em OTHER CONSIDERATIONS.

Arquitetura (proposta):

Front: Next.js (React) + PDF.js (render + text layer com bounding boxes), painel lateral sincronizado por ID de cláusula.

Back: FastAPI (Python) para parsing (pypdf/pdfplumber), segmentação e orquestração de prompts.

LLM: provedores cloud (OpenAI / Google), com function-calling para retornar JSON (explicações + flags + ficha).

Não é aconselhamento jurídico: alerta claro e persistente no painel.

## EXAMPLES:

[Provide and explain examples that you have in the `examples/` folder]

## DOCUMENTATION:

PDF.js (renderização + text layer).

pypdf/pdfplumber (extração de texto com coordenadas, manuseio de colunas e rodapés).

Heurísticas de segmentação (detecção de headings, numeração 1., 1.1., 1.1.1., termos “Cláusula”, “Seção”, “Definições”).

Function calling/JSON schema no LLM para retorno estruturado de explicações + flags + ficha.

Estratégias anti-alucinação leve: distinção entre “Explicação Geral” e “Como está no seu contrato”.

Observabilidade: logs no console (níveis INFO/WARN/ERROR), 1 retry em erros transitórios.

## OTHER CONSIDERATIONS:

1) Segmentação & Sincronização
IDs estáveis por cláusula (clause_id), com bounding boxes para sincronizar rolagem e highlight.

Tratar numeração reiniciada, subseções, rodapés repetidos e anexos.

Tolerância a colunas e listas; remover hifenização ao extrair.

2) Dois níveis de explicação (evita confusão com “conhecimento geral”)
Explicação Geral: definição didática (ex.: o que é Tag Along).

No seu contrato: como a cláusula especificamente define percentuais, gatilhos, exceções.

Se houver conflito entre a prática geral e o texto, exibir alerta suave: “O texto desta cláusula difere do uso mais comum”.

3) Ficha do Contrato (esquema sugerido)
Use como JSON de saída interno (mostrado em um cartão no topo):

json
Copy
Edit
{
  "tipo_instrumento": "mutuo_conversivel | safe | term_sheet | acordo_acionistas | side_letter",
  "partes": {
    "empresa": {"nome": "", "tipo_societario": "LTDA|SA", "cnpj": ""},
    "investidor": [{"nome": "", "tipo": "PF|PJ"}],
    "garantidores": []
  },
  "datas": {
    "assinatura": "",
    "vigencia_inicio": "",
    "vigencia_fim": "",
    "vencimento_mutuo": ""
  },
  "valores": {
    "principal": {"moeda": "BRL", "valor": 0},
    "juros_aa": null,
    "indexador": "IPCA|SELIC|NA",
    "valuation_cap": null,
    "desconto_percentual": null,
    "tamanho_rodada": null,
    "valuation_pre": null,
    "valuation_post": null
  },
  "conversao": {
    "gatilhos": ["rodada_qualificada", "maturidade", "evento_liquidez"],
    "definicao_rodada_qualificada": "",
    "formula": "cap|desconto|cap_e_desconto|preco_fixo|na",
    "mfn": true
  },
  "direitos": {
    "pro_rata": {"existe": true, "percentual": null},
    "informacao": {"periodicidade": "mensal|trimestral|semestral|anual", "escopo": ""},
    "anti_diluicao": "na|weighted_average|full_ratchet|custom",
    "preferencia_liquidacao": {"multiplo": null, "participativa": false},
    "tag_along": {"percentual": null, "condicoes": ""},
    "drag_along": {"percentual": null, "condicoes": ""},
    "veto": ["endividamento", "mudanca_objeto", "emissao_novas_quotas_acoes", "alienacao_ativos_relevantes"]
  },
  "obrigações": {
    "covenants": ["nao_concorrencia", "nao_aliciamento", "exclusividade"],
    "condicoes_precedentes": [],
    "restricoes_cessao": ""
  },
  "jurisdicao": {
    "lei_aplicavel": "Brasil",
    "foro": ""
  },
  "observacoes": ""
}
4) Motor de Bandeiras (heurísticas iniciais)
Vermelha: definição de rodada qualificada extremamente restritiva (praticamente inviável); drag acionável por < 66% sem proteção de minoritários; anti-diluição full ratchet sem limite temporal; recompra de participação do fundador a valor nominal em múltiplos cenários.

Amarela: cap omisso quando o instrumento sinaliza desconto muito baixo; pro rata sem janela/condições; juros do mútuo acima de prática de mercado; foro distante sem justificativa.

Verde: tag ≥ 100% para minoritários quando aplicável; clareza em informações periódicas e condições precedentes objetivas.

Nota: o “perspectivador” pode alternar Fundador ↔ Investidor para recalibrar as bandeiras e as perguntas de negociação.

5) Prompts & Retornos (forma)
Entrada por cláusula: {clause_text, clause_id, full_context_light}.

Saída por cláusula (JSON):

json
Copy
Edit
{
  "clause_id": "",
  "tldr": "",
  "explicacao_simples": "",
  "porque_importa": "",
  "bandeira": "verde|amarelo|vermelho",
  "motivo_bandeira": "",
  "perguntas_negociacao": ["", ""],
  "geral_vs_contrato": {
    "explicacao_geral": "",
    "como_esta_no_contrato": ""
  }
}
Saída global: ficha_contrato (esquema acima) + resumo de bandeiras.

6) UX e Acessibilidade
Painel sticky, navegação por índice de cláusulas, busca por termos (“anti-diluição”, “cap”, “foro”).

Destaque sincronizado ao passar o mouse/rolar.

Texto ajustável (tamanhos), contraste AA.

7) Robustez & Operação
Logs no console com correlação por document_id + clause_id; 1 retry em erro 5xx do provedor.

Timeouts e degração graciosa: se o custo/tempo explodir, entregar apenas TL;DR e “Por que importa”, deixando “perguntas de negociação” para segundo passo.

Testes com contratos “armadilha”: numeração quebrada, anexos sem título, cláusulas repetidas, side letters que alteram termos do principal.

8) Jurídico & Comunicação
Banner permanente: “Ferramenta educativa. Não substitui assessoria jurídica.”

Separar claramente explicação geral de interpretação do texto do contrato para reduzir risco de entendimento errado.


