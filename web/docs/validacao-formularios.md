# ADR 0002 - Validação de formulários

## Contexto
A aplicação requer formulários com validação no frontend (feedback imediato ao usuário) e integração com o backend (erros 422).  
É necessário centralizar regras de validação, reaproveitar schemas, e garantir tratamento consistente de erros.

## Decisão
- **Zod** define os schemas de validação (`cadastroSchema`, `loginSchema`).  
  - Tipos derivados via `z.infer` garantem que frontend e backend compartilham o mesmo contrato.  
- **React Hook Form (RHF)** gerencia o estado do formulário (valores, erros, validações locais).  
  - Integração com `zodResolver` aplica automaticamente as regras de Zod nos campos.  
- **TanStack React Query** lida com chamadas ao backend (`login`, `registerUser`).  
  - `useMutation` controla loading, sucesso e erro da requisição.  
- **Axios** envia as requisições para a API Laravel Sanctum.  
- **Tratamento de erros**:
  - Respostas `422` são aplicadas nos campos via `defaultFormErrorHandler` e `applyValidationErrors`.  
  - Erros gerais (`500`, conexão) são exibidos como mensagem no `root`.  

## Fluxo
1. Usuário preenche campos → RHF controla o estado.  
2. RHF valida contra o schema Zod no submit.  
3. Se válido → React Query (`useMutation`) envia dados via Axios.  
4. Backend responde:  
   - Sucesso → navegação/redirecionamento.  
   - Erro 422 → mensagens aplicadas nos campos com `setError`.  
   - Outros erros → mensagem genérica exibida.  

## Consequências
- Validações são centralizadas e tipadas.  
- Integração consistente entre frontend e backend.  
- Feedback imediato ao usuário sem duplicar lógica.  
- Baixo acoplamento: cada camada tem responsabilidade clara.

flowchart TD

A[Usuário preenche formulário] --> B[RHF controla valores e erros]
B --> C{Submit}
C -->|Validação local| D[Zod Schema via zodResolver]
D -->|Inválido| E[Mostrar erros nos campos]
D -->|Válido| F[useMutation (React Query)]
F --> G[Axios envia request p/ API]
G --> H[Backend Laravel Sanctum]

H -->|Sucesso| I[Retorna dados/200]
I --> J[onSuccess: atualizar estado e navegar]

H -->|Erro 422| K[Validações do servidor]
K --> L[applyValidationErrors → setError nos campos]

H -->|Erro genérico| M[Mensagem root: "Erro de conexão ou servidor"]