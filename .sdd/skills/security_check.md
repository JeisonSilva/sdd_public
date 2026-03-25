# Skill: Security Check

## O que faz
Checklist de segurança aplicado sobre código gerado ou revisado.
Baseado no OWASP Top 10 e boas práticas gerais.

---

## Execute este checklist sobre o código em análise

### 1. Injeção (SQL, Command, LDAP)
- [ ] Inputs do usuário são parametrizados / sanitizados antes de queries?
- [ ] Não há concatenação de strings com input externo em queries SQL?
- [ ] Não há `eval()`, `exec()` ou execução de shell com input do usuário?

### 2. Autenticação e Sessão
- [ ] Senhas armazenadas com hash forte (bcrypt, argon2)?
- [ ] Tokens JWT validam assinatura, expiração e issuer?
- [ ] Existe rate limiting em endpoints de login/registro?
- [ ] Sessões são invalidadas no logout?

### 3. Exposição de Dados Sensíveis
- [ ] Nenhum segredo hardcoded (API keys, senhas, tokens)?
- [ ] Logs não registram dados pessoais ou credenciais?
- [ ] Respostas de erro não expõem stack trace ou detalhes internos?
- [ ] Dados sensíveis em trânsito usam HTTPS/TLS?

### 4. Controle de Acesso
- [ ] Verificação de permissão feita no servidor (não só no cliente)?
- [ ] IDs de recursos validados contra o usuário autenticado?
- [ ] Endpoints administrativos protegidos por role?

### 5. Validação de Input
- [ ] Todos os inputs externos são validados (tipo, tamanho, formato)?
- [ ] Upload de arquivos valida tipo real (não só extensão)?
- [ ] Parâmetros de paginação têm limite máximo?

### 6. Dependências
- [ ] Versões de dependências fixadas (evitar `latest`)?
- [ ] Dependências conhecidas por vulnerabilidades recentes?

---

## Formato de saída

```markdown
## Security Check — `[contexto]`

### ✅ Aprovado
- [item que está ok]

### ⚠️ Atenção necessária
- **[categoria]** [problema] → [como corrigir]

### 🔴 Bloqueador
- **[categoria]** [vulnerabilidade crítica] → [correção obrigatória]
```

---

## Regras

- Um item 🔴 **Bloqueador** impede o código de ir para produção
- Itens ⚠️ devem ser resolvidos antes do próximo sprint
- Documente como falso positivo quando um item não se aplica ao contexto
