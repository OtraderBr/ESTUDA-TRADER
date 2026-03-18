// data/pa-concepts.js
// Dataset de conceitos de Price Action reorganizado para trader
// Estrutura: Ciclos de Mercado → Rompimento/Continuidade/Reversão → Setups → Padrões

export const PA_CONCEPTS = [
  // ==================== EVOLUÇÃO - CICLOS DE MERCADO ====================
  { id: 'ciclo1', mode: 'evolucao', category: 'Ciclos de Mercado', subcategory: 'Fases do Mercado', title: 'Tendência de Alta', notes: 'HH + HL - Higher Highs e Higher Lows' },
  { id: 'ciclo2', mode: 'evolucao', category: 'Ciclos de Mercado', subcategory: 'Fases do Mercado', title: 'Tendência de Baixa', notes: 'LH + LL - Lower Highs e Lower Lows' },
  { id: 'ciclo3', mode: 'evolucao', category: 'Ciclos de Mercado', subcategory: 'Fases do Mercado', title: 'Trading Range (Lateralidade)', notes: 'Preço oscila entre S/R definidos' },
  { id: 'ciclo4', mode: 'evolucao', category: 'Ciclos de Mercado', subcategory: 'Fases do Mercado', title: 'Rompimento (Breakout)', notes: 'Preço sai de TR com força e volume' },
  { id: 'ciclo5', mode: 'evolucao', category: 'Ciclos de Mercado', subcategory: 'Fases do Mercado', title: 'Reversão', notes: 'Mudança de direção da tendência' },

  // ==================== LEITURA - CONTEXTU ====================
  { id: 'leitura1', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Contexto', title: 'Always In Long (AIL)', notes: 'Viés de compra - procurar compras' },
  { id: 'leitura2', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Contexto', title: 'Always In Short (AIS)', notes: 'Viés de venda - procurar vendas' },
  { id: 'leitura3', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Contexto', title: 'BLSHS', notes: 'Buy Low Sell High Scalp - em TR' },
  { id: 'leitura4', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Estrutura', title: 'Swing High / Swing Low', notes: 'Topos e fundos significativos' },
  { id: 'leitura5', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Estrutura', title: 'Pivôs', notes: 'Pontos de reversão importantes' },
  { id: 'leitura6', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Estrutura', title: 'Pernas / Legs', notes: 'Movimentos entre pivôs' },
  { id: 'leitura7', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Contagem', title: 'H1-H4 (Highs)', notes: 'Contagem de topos em correção' },
  { id: 'leitura8', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Contagem', title: 'L1-L4 (Lows)', notes: 'Contagem de fundos em correção' },
  { id: 'leitura9', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Multi-Timeframe', title: 'HTF Contexto', notes: 'Timeframe maior para direção' },
  { id: 'leitura10', mode: 'evolucao', category: 'Leitura de Mercado', subcategory: 'Multi-Timeframe', title: 'LTF Entrada', notes: 'Timeframe menor para refinar' },

  // ==================== ROMPIMENTO ====================
  { id: 'romp1', mode: 'evolucao', category: 'Rompimento', subcategory: 'Características', title: 'BO com Gap', notes: 'Rompimento ideal com gap de preço' },
  { id: 'romp2', mode: 'evolucao', category: 'Rompimento', subcategory: 'Características', title: 'Barra Grande', notes: 'Barra de rompimento com corpo grande' },
  { id: 'romp3', mode: 'evolucao', category: 'Rompimento', subcategory: 'Características', title: 'Follow-Through', notes: 'Continuação após rompimento' },
  { id: 'romp4', mode: 'evolucao', category: 'Rompimento', subcategory: 'Falhas', title: 'Rompimento Falho', notes: '80% dos breakouts falham' },
  { id: 'romp5', mode: 'evolucao', category: 'Rompimento', subcategory: 'Falhas', title: 'Bull Trap', notes: 'Falso rompimento de alta' },
  { id: 'romp6', mode: 'evolucao', category: 'Rompimento', subcategory: 'Falhas', title: 'Bear Trap', notes: 'Falso rompimento de baixa' },
  { id: 'romp7', mode: 'evolucao', category: 'Rompimento', subcategory: 'Medidos', title: 'Altura do BO', notes: 'Projeção = altura do breakout' },
  { id: 'romp8', mode: 'evolucao', category: 'Rompimento', subcategory: 'Medidos', title: 'Altura da TR', notes: 'Projeção = altura do trading range' },

  // ==================== CONTINUIDADE ====================
  { id: 'cont1', mode: 'evolucao', category: 'Continuidade', subcategory: 'Tendência', title: 'Micro Canal', notes: 'Tendência mais forte - 4+ barras' },
  { id: 'cont2', mode: 'evolucao', category: 'Continuidade', subcategory: 'Tendência', title: 'Canal Estreito', notes: 'Correções rasas - pullback de 1-2 barras' },
  { id: 'cont3', mode: 'evolucao', category: 'Continuidade', subcategory: 'Tendência', title: 'Canal Amplo', notes: 'Correções profundas - pullback de 3+ barras' },
  { id: 'cont4', mode: 'evolucao', category: 'Continuidade', subcategory: 'Padrões', title: 'Bull Flag', notes: 'Correção em tendência de alta' },
  { id: 'cont5', mode: 'evolucao', category: 'Continuidade', subcategory: 'Padrões', title: 'Bear Flag', notes: 'Correção em tendência de baixa' },
  { id: 'cont6', mode: 'evolucao', category: 'Continuidade', subcategory: 'Padrões', title: 'Bandeira Final', notes: 'Última bandeira antes da TR' },
  { id: 'cont7', mode: 'evolucao', category: 'Continuidade', subcategory: 'Padrões', title: '2 Legs Pullback', notes: 'Correção em 2 pernas' },
  { id: 'cont8', mode: 'evolucao', category: 'Continuidade', subcategory: 'Medidos', title: 'Measured Move (MM)', notes: 'Leg1 = Leg2' },

  // ==================== REVERSÃO ====================
  { id: 'rev1', mode: 'evolucao', category: 'Reversão', subcategory: 'Padrões', title: 'MTR (Major Trend Reversal)', notes: 'Reversão de tendência principal' },
  { id: 'rev2', mode: 'evolucao', category: 'Reversão', subcategory: 'Padrões', title: 'Cunha (Wedge)', notes: '3 pushes com linhas convergentes' },
  { id: 'rev3', mode: 'evolucao', category: 'Reversão', subcategory: 'Padrões', title: 'Topo/Fundo Duplo', notes: 'Maioria das reversões são duplas' },
  { id: 'rev4', mode: 'evolucao', category: 'Reversão', subcategory: 'Padrões', title: 'Head and Shoulders', notes: 'Ombro-Cabeça-Ombro' },
  { id: 'rev5', mode: 'evolucao', category: 'Reversão', subcategory: 'Padrões', title: 'Triângulos', notes: 'Reversão ou continuação' },
  { id: 'rev6', mode: 'evolucao', category: 'Reversão', subcategory: 'Exaustão', title: 'Buying Climax', notes: 'Exaustão de compra' },
  { id: 'rev7', mode: 'evolucao', category: 'Reversão', subcategory: 'Exaustão', title: 'Selling Climax', notes: 'Exaustão de venda' },
  { id: 'rev8', mode: 'evolucao', category: 'Reversão', subcategory: 'Exaustão', title: 'Reversão Falha', notes: '80% das reversões falham' },

  // ==================== SETUPS H1 ====================
  { id: 'setup1', mode: 'evolucao', category: 'Setups', subcategory: 'H1', title: 'Setup H1 de Rompimento', notes: '1ª perna após rompimento' },
  { id: 'setup2', mode: 'evolucao', category: 'Setups', subcategory: 'H1', title: 'Setup H1 de Continuidade', notes: 'Pullback H1 em tendência' },
  { id: 'setup3', mode: 'evolucao', category: 'Setups', subcategory: 'H1', title: 'Setup H1 de Reversão', notes: '1ª perna de reversão' },
  { id: 'setup4', mode: 'evolucao', category: 'Setups', subcategory: 'H2', title: 'Setup H2', notes: '2ª perna - maior probabilidade' },
  { id: 'setup5', mode: 'evolucao', category: 'Setups', subcategory: 'H3', title: 'Setup H3', notes: '3ª perna - exaustão possível' },
  { id: 'setup6', mode: 'evolucao', category: 'Setups', subcategory: 'H4', title: 'Setup H4', notes: '4ª perna - TR iminente' },
  { id: 'setup7', mode: 'evolucao', category: 'Setups', subcategory: 'L1', title: 'Setup L1 de Rompimento', notes: '1ª perna baixa após rompimento' },
  { id: 'setup8', mode: 'evolucao', category: 'Setups', subcategory: 'L2', title: 'Setup L2', notes: '2ª perna baixa' },

  // ==================== OPERAÇÕES - OPERACIONAL ====================
  { id: 'op1', mode: 'operacao', category: 'Operacional', subcategory: 'Entradas', title: 'Compra em Pullback', notes: 'Entrar na 1ª/2ª perna de correção' },
  { id: 'op2', mode: 'operacao', category: 'Operacional', subcategory: 'Entradas', title: 'Venda em Rally', notes: 'Entrar na correção de alta' },
  { id: 'op3', mode: 'operacao', category: 'Operacional', subcategory: 'Entradas', title: 'Entrar em BO', notes: 'Com gap, barra grande, follow-through' },
  { id: 'op4', mode: 'operacao', category: 'Operacional', subcategory: 'Entradas', title: 'BTC (Buy The Close)', notes: 'Comprar no fechamento da barra' },
  { id: 'op5', mode: 'operacao', category: 'Operacional', subcategory: 'Entradas', title: 'STC (Sell The Close)', notes: 'Vender no fechamento da barra' },
  { id: 'op6', mode: 'operacao', category: 'Operacional', subcategory: 'Gestão', title: 'Posicionar Stop Loss', notes: 'Abaixo HL / acima LH' },
  { id: 'op7', mode: 'operacao', category: 'Operacional', subcategory: 'Gestão', title: 'Scale In', notes: 'Adicionar em lucro' },
  { id: 'op8', mode: 'operacao', category: 'Operacional', subcategory: 'Gestão', title: 'Scale Out', notes: 'Realizar parcial' },
  { id: 'op9', mode: 'operacao', category: 'Operacional', subcategory: 'Gestão', title: 'Trailing Stop', notes: 'Mover stop seguindo estrutura' },
  { id: 'op10', mode: 'operacao', category: 'Operacional', subcategory: 'Gestão', title: 'Breakeven', notes: 'Proteger entrada no zero a zero' },
  { id: 'op11', mode: 'operacao', category: 'Operacional', subcategory: 'Timing', title: 'Operar na Abertura', notes: '80% reversão / 20% tendência' },
  { id: 'op12', mode: 'operacao', category: 'Operacional', subcategory: 'Timing', title: 'Armadilhas Final Dia', notes: 'Bull/Bear traps na última hora' },

  // ==================== PSICOLÓGIA ====================
  { id: 'psi1', mode: 'operacao', category: 'Psicologia', subcategory: 'Sucesso', title: 'Disciplina', notes: 'Seguir regras do setup' },
  { id: 'psi2', mode: 'operacao', category: 'Psicologia', subcategory: 'Sucesso', title: 'Paciência', notes: 'Aguardar setup ideal' },
  { id: 'psi3', mode: 'operacao', category: 'Psicologia', subcategory: 'Erros', title: 'FOMO', notes: 'Medo de ficar de fora - evitar' },
  { id: 'psi4', mode: 'operacao', category: 'Psicologia', subcategory: 'Erros', title: 'Revenge Trading', notes: 'Não vingar perdas' },
  { id: 'psi5', mode: 'operacao', category: 'Psicologia', subcategory: 'Erros', title: 'Overtrading', notes: 'Operar demais' },

  // ==================== PADRÕES DE BARRAS ====================
  { id: 'barr1', mode: 'evolucao', category: 'Barras', subcategory: 'Anatomia', title: 'Corpo da Barra', notes: 'Abertura até fechamento' },
  { id: 'barr2', mode: 'evolucao', category: 'Barras', subcategory: 'Anatomia', title: 'Sombra da Barra', notes: 'Cauda superior e inferior' },
  { id: 'barr3', mode: 'evolucao', category: 'Barras', subcategory: 'Tipos', title: 'Trend Bar', notes: 'Corpo grande - tendência' },
  { id: 'barr4', mode: 'evolucao', category: 'Barras', subcategory: 'Tipos', title: 'Doji', notes: 'Corpo pequeno - indecisão' },
  { id: 'barr5', mode: 'evolucao', category: 'Barras', subcategory: 'Tipos', title: 'Inside Bar (i)', notes: 'Dentro da barra anterior' },
  { id: 'barr6', mode: 'evolucao', category: 'Barras', subcategory: 'Tipos', title: 'Outside Bar (o)', notes: 'Engolfa barra anterior' },
  { id: 'barr7', mode: 'evolucao', category: 'Barras', subcategory: 'Tipos', title: 'Reversal Bar', notes: 'Barra de reversão com sombra longa' },
  { id: 'barr8', mode: 'evolucao', category: 'Barras', subcategory: 'Padrões', title: 'ii', notes: '2 inside bars - compressão' },
  { id: 'barr9', mode: 'evolucao', category: 'Barras', subcategory: 'Padrões', title: 'ioi', notes: 'Inside-outside-inside' },
  { id: 'barr10', mode: 'evolucao', category: 'Barras', subcategory: 'Padrões', title: 'oo', notes: '2 outside bars' },

  // ==================== S/R E GAPS ====================
  { id: 'sr1', mode: 'evolucao', category: 'S/R', subcategory: 'Suporte/Resistência', title: 'S/R Controlam Preço', notes: 'Zonas de decisão' },
  { id: 'sr2', mode: 'evolucao', category: 'S/R', subcategory: 'Gaps', title: 'Gap', notes: 'Espaço entre barras' },
  { id: 'sr3', mode: 'evolucao', category: 'S/R', subcategory: 'Gaps', title: 'MAG (Moving Average Gap)', notes: 'Gap entre preço e MA' },
  { id: 'sr4', mode: 'evolucao', category: 'S/R', subcategory: 'Linhas', title: 'Linha de Tendência', notes: 'Conecta pivôs da tendência' },
  { id: 'sr5', mode: 'evolucao', category: 'S/R', subcategory: 'Linhas', title: 'Linha de Canal', notes: 'Conecta extremos do canal' },

  // ==================== ANOTAÇÕES / BOX TEXTO ====================
  { id: 'note1', mode: 'evolucao', category: 'Anotações', subcategory: 'Texto', title: 'Box de Texto', notes: 'Anotação livre no canvas' },
  { id: 'note2', mode: 'evolucao', category: 'Anotações', subcategory: 'Observação', title: 'Observação de Tela', notes: 'Comentário sobre movimento' },
  { id: 'note3', mode: 'operacao', category: 'Anotações', subcategory: 'Trade', title: 'Registro de Trade', notes: 'Entrada, saída, resultado' },
];
