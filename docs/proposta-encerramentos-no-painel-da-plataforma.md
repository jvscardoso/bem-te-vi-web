# Proposta para a API · Encerramentos pedidos no painel da plataforma

**De:** front (bem-te-vi-web) · **Para:** sessão da API · **Data:** 09/10/2026 · **Relacionada à:** task 11

## Problema

A task 11 pede, no painel da plataforma, "um filtro ou ordenação para achar" as clínicas com encerramento pedido, e o botão "Excluir definitivamente" habilitado só depois da carência. Com o contrato atual de `GET /platform/tenants`, nenhum dos dois dá para fazer direito:

1. **Sem filtro nem ordenação no servidor.** A lista é paginada e ordenada por nome. Um filtro no front só enxergaria a página atual, e uma clínica com pedido na página 3 continuaria escondida.
2. **Sem a data de liberação.** A lista traz `closureRequestedAt`, mas não `deletionAvailableAt` nem `graceDays`. O front teria de supor 30 dias, o que diverge quando `TENANT_DELETION_GRACE_DAYS` é outro (em dev, 0). Hoje o botão aparece para toda clínica com pedido, e quem confere a carência é a API (o `409` traz a data).

## Proposta

1. Filtro em `GET /platform/tenants`: `?closure=requested`, só clínicas com `closureRequestedAt` não nulo. Opcionalmente, `?closure=deletable` para as que já passaram da carência.
2. Em cada clínica da lista, incluir `deletionAvailableAt` (`null` sem pedido), calculado como em `GET /tenants/:id/closure`.

```json
{ "id": "...", "name": "...", "closureRequestedAt": "2026-10-09T16:01:29Z", "deletionAvailableAt": "2026-11-08T16:01:29Z", "...": "..." }
```

## Impacto no front

- Um seletor "Todas / Encerramento pedido / Prontas para excluir" na lista de clínicas.
- O selo passa a mostrar "exclusão liberada a partir de DD/MM", e o botão "Excluir definitivamente" fica habilitado só quando `deletionAvailableAt` já passou. O `409` continua tratado.
