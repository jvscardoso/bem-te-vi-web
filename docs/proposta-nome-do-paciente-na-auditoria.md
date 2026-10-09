# Proposta para a API · Nome do paciente nos registros da trilha de auditoria

**De:** front (bem-te-vi-web) · **Para:** sessão da API · **Data:** 09/10/2026 · **Relacionada à:** task 08

## Problema

`GET /tenants/:tenantId/audit-logs` devolve só `patientId` em cada registro. A tela "Auditoria" do front precisa mostrar **qual paciente** foi acessado, e hoje não tem como:

- Buscar o nome por `GET /patients/:id` gera um registro `patient.view` **para cada linha exibida**: quem consulta a trilha passaria a aparecer nela como se tivesse aberto dezenas de fichas. É exatamente o tipo de poluição que a task 08 pede para evitar.
- Paciente removido nem é encontrado por essa rota.

Hoje a coluna "Paciente" mostra um link "Abrir ficha". O nome só aparece quando a tela está filtrada por um paciente escolhido na busca.

## Proposta

Incluir o nome do paciente em cada registro, no mesmo padrão do `actor`:

```json
{
  "id": "uuid",
  "action": "patient.update",
  "patientId": "uuid",
  "patient": { "id": "uuid", "fullName": "Maria da Silva", "removed": false },
  "actor": { "id": "uuid", "name": "Dra. Ana" },
  "...": "..."
}
```

- `patient` é `null` quando o registro não é de um paciente (`patient.list`, `tenant.export` etc.).
- `fullName` pode vir `null` se o paciente foi apagado definitivamente (como `actor.name`).
- `removed: true` para paciente removido (soft delete), para o front avisar que a ficha não abre.
- A leitura da trilha **não** deve gerar registro de `patient.view`: quem tem `audit:read` já vê só metadados, sem conteúdo clínico.

## Impacto no front

Só exibição. Assim que a API devolver `patient`, o front troca "Abrir ficha" pelo nome, sem mudar mais nada.
