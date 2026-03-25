# Skill: Explain Code

## O que faz
Explica código de forma clara, adaptando o nível de detalhe ao contexto do usuário.

---

## Processo

1. **Identifique o nível** do usuário pela forma como pergunta:
   - Pergunta simples → explicação direta, sem jargão excessivo
   - Pergunta técnica → pode usar termos técnicos com precisão

2. **Estruture a explicação** de cima para baixo:
   - O que este código FAZ (propósito)
   - Como funciona (passo a passo)
   - Por que foi feito assim (decisão de design)
   - O que pode dar errado (limitações / edge cases)

3. **Use analogias** quando a lógica for abstrata

---

## Formato de saída

```markdown
## Explicação: `[função / arquivo / trecho]`

### O que faz
[1-2 frases descrevendo o propósito em linguagem simples]

### Como funciona

**Passo 1**: [nome do passo]
[explicação do que acontece]
```[linguagem]
[trecho relevante do código]
```

**Passo 2**: ...

### Por que foi feito assim
[Decisão de design, trade-off ou restrição que explica a implementação]

### Atenções / Limitações
- [edge case ou situação especial a observar]
- [o que este código NÃO faz]

### Perguntas para ir além
- [pergunta que o dev pode fazer para se aprofundar]
```

---

## Regras

- Nunca suponha que o usuário não sabe algo — explique e deixe-o ignorar se souber
- Use exemplos concretos, não abstrações
- Se o código for confuso, diga isso — não finja que é claro
- Se houver um jeito mais simples de fazer, mencione
