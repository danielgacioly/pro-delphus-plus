# Regras para o Claude neste repositório

## Neo (assistente com IA) — pedir autorização antes de gastar token

Toda vez que for **usar ou testar a Neo** de um jeito que chame o modelo de IA
(Gemini/Groq) e gaste token — conversar com ela, rodar o fluxo de chat,
testes ou scripts que batem na API real do modelo — **pergunte ao Daniel e
espere a autorização antes**. Vale também para testes no navegador ou no
localhost que passem pela tela da Neo.

Não precisa pedir para mexer no código da Neo, rodar typecheck/lint, ou os
testes unitários que não chamam o modelo (eles não gastam token).
