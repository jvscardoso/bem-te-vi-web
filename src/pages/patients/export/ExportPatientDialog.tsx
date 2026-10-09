import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { patientsApi, type PatientExport } from '@/api/patients';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { saveJson } from '@/lib/download';
import { PatientExportView } from './PatientExportView';

interface ExportPatientDialogProps {
  patient: { id: string; fullName: string };
  onClose: () => void;
}

const fileName = (id: string) => `paciente-${id}.json`;

/**
 * "Exportar dados (LGPD)": confirma, busca o arquivo autenticado e baixa. Cada busca fica
 * registrada na auditoria, então "baixar de novo" e o formato legível reaproveitam os dados.
 */
export function ExportPatientDialog({ patient, onClose }: ExportPatientDialogProps) {
  const tenantId = useTenantId();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [readable, setReadable] = useState(false);

  const exportData = useMutation({
    mutationFn: () => patientsApi.export(tenantId, patient.id),
    onSuccess: (data) => {
      saveJson(data, fileName(patient.id));
      // A exportação entra no histórico de acessos do paciente.
      void queryClient.invalidateQueries({ queryKey: ['audit-logs', tenantId] });
    },
  });
  const data: PatientExport | undefined = exportData.data;

  return (
    <>
      <Dialog
        open={!readable}
        onClose={exportData.isPending ? undefined : onClose}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreen}
      >
        <DialogTitle>Exportar dados do paciente</DialogTitle>
        <DialogContent>
          {data ? (
            <Stack spacing={2}>
              <Alert severity="success">
                Arquivo <strong>{fileName(patient.id)}</strong> baixado com os dados de {patient.fullName}.
              </Alert>
              <DialogContentText>
                Se o paciente não souber abrir o arquivo, use o formato legível para imprimir ou salvar em PDF.
              </DialogContentText>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <DialogContentText>
                Gera um arquivo com tudo o que a clínica guarda sobre <strong>{patient.fullName}</strong>: cadastro,
                fichas de anamnese, agendamentos e cobranças. É o atendimento ao pedido de acesso do titular (LGPD).
              </DialogContentText>
              <Alert severity="warning">
                O arquivo contém todos os dados do paciente, inclusive o prontuário. Entregue somente ao próprio
                paciente ou a quem ele autorizar. A exportação fica registrada.
              </Alert>
              <ErrorMessages error={exportData.error} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          {data ? (
            <>
              <Button onClick={() => saveJson(data, fileName(patient.id))}>Baixar de novo</Button>
              <Button onClick={() => setReadable(true)}>Ver em formato legível</Button>
              <Button variant="contained" onClick={onClose}>
                Fechar
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onClose} disabled={exportData.isPending}>
                Cancelar
              </Button>
              <Button variant="contained" onClick={() => exportData.mutate()} loading={exportData.isPending}>
                Exportar
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {readable && data && <PatientExportView data={data} onClose={() => setReadable(false)} />}
    </>
  );
}
