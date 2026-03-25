# Skill: Generate Tests

## O que faz
Estrutura a geração de testes de forma sistemática, garantindo cobertura real dos comportamentos.

---

## Processo de geração

### Passo 1: Mapear comportamentos
Antes de escrever uma linha de teste, liste os comportamentos:

```
Função/módulo: [nome]

Comportamentos a testar:
1. [happy path principal]
2. [variação do happy path]
3. [input inválido / vazio / nulo]
4. [condição de erro / exceção]
5. [edge case: valor limite]
6. [edge case: valor extremo]
```

### Passo 2: Definir estrutura

```
tests/
└── [módulo]/
    ├── test_[nome]_unit.py       # unitários (sem dependências)
    ├── test_[nome]_integration.py # com DB/APIs reais
    └── fixtures/
        └── [dados de teste]
```

### Passo 3: Template de teste unitário

```python
# Python/pytest
class TestNomeDaFuncao:
    """Testa [o que a função faz]."""

    def test_should_[resultado]_when_[condicao](self):
        # Arrange
        [prepare os dados e mocks]

        # Act
        result = funcao(input)

        # Assert
        assert result == expected

    def test_should_raise_[erro]_when_[condicao](self):
        # Arrange + Act + Assert
        with pytest.raises(TipoDoErro, match="mensagem esperada"):
            funcao(input_invalido)
```

```typescript
// TypeScript/Jest ou Vitest
describe('nomeDaFuncao', () => {
  it('should [resultado] when [condicao]', () => {
    // Arrange
    const input = ...

    // Act
    const result = nomeDaFuncao(input)

    // Assert
    expect(result).toEqual(expected)
  })

  it('should throw [erro] when [condicao]', () => {
    expect(() => nomeDaFuncao(invalidInput)).toThrow('mensagem')
  })
})
```

### Passo 4: Critérios de qualidade

- [ ] Cada teste tem um único `assert` principal
- [ ] Nome do teste descreve comportamento, não implementação
- [ ] Mocks apenas para dependências externas (DB, API, filesystem, relógio)
- [ ] Nenhum teste depende de ordem de execução
- [ ] Dados de teste são declarados no próprio teste (não em arquivo externo sem motivo)

---

## Cobertura mínima recomendada

| Tipo de código | Cobertura mínima |
|---|---|
| Regras de negócio críticas | 90%+ |
| Lógica de validação | 85%+ |
| Handlers de API | 80%+ |
| Utilitários | 70%+ |
| Adaptadores de infra | 60%+ (integration) |
