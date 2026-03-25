# Skill: ADR — Architecture Decision Record

## O que faz
Documenta decisões arquiteturais importantes de forma estruturada e rastreável.
Use sempre que uma decisão técnica significativa for tomada.

---

## Quando criar um ADR

- Escolha de tecnologia ou framework
- Mudança de padrão arquitetural
- Decisão de não fazer algo (e por quê)
- Trade-off consciente entre opções

---

## Template

```markdown
# ADR-[NNN]: [Título da Decisão]

**Data**: [YYYY-MM-DD]
**Status**: Proposta | Aceita | Depreciada | Substituída por ADR-[NNN]
**Decisores**: [quem participou da decisão]

---

## Contexto

[Descreva o problema ou necessidade que levou a esta decisão.
Quais forças estão em jogo? Quais restrições existem?]

## Opções Consideradas

### Opção 1: [Nome]
- **Prós**: ...
- **Contras**: ...

### Opção 2: [Nome]
- **Prós**: ...
- **Contras**: ...

### Opção 3: [Nome] *(se aplicável)*
- **Prós**: ...
- **Contras**: ...

## Decisão

**Escolhemos**: [Opção X]

**Justificativa**: [Por que esta opção dado o contexto atual.
Seja específico sobre quais forças foram priorizadas.]

## Consequências

**Positivas**:
- [resultado bom esperado]

**Negativas / Trade-offs aceitos**:
- [o que estamos abrindo mão]

**Riscos**:
- [o que pode dar errado e como mitigar]

## Referências
- [links, documentos, conversas relevantes]
```

---

## Onde salvar

Recomendado: `docs/decisions/ADR-NNN-titulo-kebab-case.md`

Os ADRs devem ser **imutáveis** após aceitos.
Se a decisão mudar, crie um novo ADR marcando o anterior como "Substituído por ADR-NNN".
