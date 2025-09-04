# ADR 0001 - Autenticação

## Contexto
A aplicação necessita de um mecanismo para identificar usuários, controlar sessões e restringir acesso a rotas privadas.  
O backend utiliza **Laravel Sanctum** para emissão e validação de tokens de autenticação.

No frontend React, é necessário:
- Armazenar o token emitido pelo backend.  
- Manter o estado de autenticação disponível em toda a aplicação.  
- Controlar acesso às rotas de acordo com a presença de token e dados do usuário.  
- Sincronizar a sessão do usuário com o backend (ex.: buscar dados ao iniciar).

## Decisão
- O estado global de autenticação foi implementado com **Zustand**, em vez de Redux ou Context API, pela simplicidade e menor boilerplate.  
- O token é armazenado em **localStorage** sob a chave `ACCESS_TOKEN`, garantindo persistência entre recarregamentos.  
- O store expõe funções:
  - `setToken` → define o token no estado global e persiste em localStorage.  
  - `setUser` → define o usuário autenticado.  
  - `fetchUser` → requisita os dados do usuário no backend com base no token.  
  - `logout` → revoga o token no backend e limpa o estado/localStorage.  
- **React Router** controla o acesso às rotas:
  - `DefaultLayout` → protege rotas privadas, redireciona ao login se não houver token.  
  - `GuestLayout` → impede acesso a rotas públicas (login, cadastro) caso o usuário já esteja autenticado.  
- O **Axios** é configurado com um interceptor para:
  - Incluir o token no header `Authorization`.  
  - Revogar automaticamente o token em caso de resposta `401 Unauthorized`.

## Consequências
- O fluxo de autenticação é simples de manter e consistente entre backend e frontend.  
- A separação em `DefaultLayout` e `GuestLayout` facilita a proteção de rotas e mantém a lógica de UI organizada.  
- O uso de Zustand reduz a complexidade em comparação a Redux, mantendo a reatividade do estado.  
- O token no localStorage garante persistência, mas não é o método mais seguro em cenários de alta criticidade (vulnerável a XSS).  
- Existe um pequeno "flash" ao carregar rotas privadas enquanto o `fetchUser` é executado, que pode ser mitigado com otimizações futuras.
