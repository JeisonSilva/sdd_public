# Skill: User Story

## O que faz
Formata qualquer necessidade de negócio no padrão de User Story com critérios de aceite.

---

## Template

```markdown
## User Story: [ID] — [Nome Curto]

**Como** [persona / tipo de usuário],
**quero** [ação ou capacidade],
**para** [benefício ou objetivo de negócio].

---

### Critérios de Aceite

**Cenário 1: [Happy Path]**
- **Dado** [contexto inicial]
- **Quando** [ação do usuário]
- **Então** [resultado esperado]

**Cenário 2: [Caso de Erro]**
- **Dado** [contexto]
- **Quando** [ação]
- **Então** [mensagem de erro ou comportamento esperado]

**Cenário 3: [Edge Case]**
- **Dado** [contexto especial]
- **Quando** [ação]
- **Então** [resultado]

---

### Definição de Pronto (DoD)
- [ ] Código implementado e revisado
- [ ] Testes unitários escritos e passando
- [ ] Critérios de aceite validados manualmente
- [ ] Documentação atualizada (se aplicável)

### Notas técnicas
[Restrições, dependências ou informações para o dev]

**Estimativa**: [P / M / G / XG]
**Prioridade**: [Alta / Média / Baixa]
```

---

## Como usar

Cole o template acima e preencha os campos `[ ]`.
A persona deve ser específica: "usuário administrador", "cliente não autenticado", não apenas "usuário".
