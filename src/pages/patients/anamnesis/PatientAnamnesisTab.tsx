import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMore from '@mui/icons-material/ExpandMore';
import NoteAddOutlined from '@mui/icons-material/NoteAddOutlined';
import { anamnesisApi, anamnesisKeys } from '@/api/anamnesis';
import type { AnamnesisRecord, AnamnesisTemplate, Patient } from '@/api/types';
import { usersApi, usersKeys } from '@/api/users';
import { useAuth, useTenantId } from '@/auth/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { ErrorMessages } from '@/components/ErrorMessages';
import { formatDateTime } from '@/lib/format';
import { answerRows } from '@/pages/anamnesis/answers';

export function PatientAnamnesisTab({ patient }: { patient: Patient }) {
  const tenantId = useTenantId();
  const { can } = useAuth();

  const records = useQuery({
    queryKey: anamnesisKeys.records(tenantId, patient.id),
    queryFn: () => anamnesisApi.records(tenantId, patient.id),
  });
  const templates = useQuery({
    queryKey: anamnesisKeys.templates(tenantId),
    queryFn: () => anamnesisApi.templates(tenantId),
  });
  // Nome de quem preencheu: só dá para resolver com a lista de profissionais.
  const professionals = useQuery({
    queryKey: usersKeys.professionals(tenantId),
    queryFn: () => usersApi.professionals(tenantId),
    enabled: can('appointments:read'),
  });

  const templatesById = useMemo(
    () => new Map((templates.data ?? []).map((template) => [template.id, template])),
    [templates.data],
  );
  const namesById = useMemo(
    () => new Map((professionals.data ?? []).map((professional) => [professional.id, professional.name])),
    [professionals.data],
  );

  const fillButton = can('patients:write') && (
    <Button
      component={RouterLink}
      to={`/pacientes/${patient.id}/anamneses/nova`}
      variant="contained"
      startIcon={<NoteAddOutlined />}
    >
      Preencher anamnese
    </Button>
  );

  if (records.error) return <ErrorMessages error={records.error} />;
  if (records.isPending || templates.isPending) return <Skeleton variant="rounded" height={160} />;

  if (records.data.length === 0) {
    return (
      <Paper variant="outlined">
        <EmptyState
          title="Nenhuma anamnese registrada"
          description={can('patients:write') ? 'Preencha a primeira ficha deste paciente.' : undefined}
          action={fillButton}
        />
      </Paper>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 960 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography color="text.secondary">
          {records.data.length} {records.data.length === 1 ? 'ficha registrada' : 'fichas registradas'}
        </Typography>
        {fillButton}
      </Stack>

      <Box>
        {records.data.map((record, index) => (
          <RecordAccordion
            key={record.id}
            record={record}
            template={templatesById.get(record.templateId)}
            filledBy={namesById.get(record.filledByUserId)}
            defaultExpanded={index === 0}
          />
        ))}
      </Box>
    </Stack>
  );
}

interface RecordAccordionProps {
  record: AnamnesisRecord;
  template?: AnamnesisTemplate;
  filledBy?: string;
  defaultExpanded: boolean;
}

function RecordAccordion({ record, template, filledBy, defaultExpanded }: RecordAccordionProps) {
  const rows = answerRows(record.answers, template?.fields);

  return (
    <Accordion defaultExpanded={defaultExpanded} variant="outlined" disableGutters>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box>
          <Typography sx={{ fontWeight: 600 }}>{record.template.name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {formatDateTime(record.createdAt)}
            {filledBy && ` · por ${filledBy}`}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        {rows.length === 0 ? (
          <Typography color="text.secondary">Nenhuma resposta registrada.</Typography>
        ) : (
          <Box
            component="dl"
            sx={{ m: 0, display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}
          >
            {rows.map((row) => (
              <Box key={row.key} sx={{ gridColumn: row.multiline ? '1 / -1' : undefined, minWidth: 0 }}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {row.label}
                </Typography>
                <Typography component="dd" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {row.value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
