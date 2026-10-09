import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Box, Skeleton, Tab, Tabs } from '@mui/material';
import { tenantKeys, tenantsApi } from '@/api/tenants';
import { useTenantId } from '@/auth/AuthContext';
import { ErrorMessages } from '@/components/ErrorMessages';
import { PageHeader } from '@/components/PageHeader';
import { BrandingTab } from './BrandingTab';
import { DomainTab } from './DomainTab';
import { GeneralTab } from './GeneralTab';
import { ScheduleTab } from './ScheduleTab';
import { ClosureTab } from './closure/ClosureTab';

const TABS = [
  { value: 'dados', label: 'Dados' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'marca', label: 'Marca' },
  { value: 'dominio', label: 'Domínio próprio' },
  { value: 'encerrar', label: 'Encerrar conta' },
] as const;

type TabValue = (typeof TABS)[number]['value'];

/** /configuracoes?aba=marca — exige tenant:manage. */
export function SettingsPage() {
  const tenantId = useTenantId();
  const [params, setParams] = useSearchParams();
  const requested = params.get('aba');
  const tab: TabValue = TABS.some((item) => item.value === requested) ? (requested as TabValue) : 'dados';

  const query = useQuery({ queryKey: tenantKeys.detail(tenantId), queryFn: () => tenantsApi.get(tenantId) });

  return (
    <Box sx={{ maxWidth: 880 }}>
      <PageHeader title="Configurações da clínica" />
      <Tabs
        value={tab}
        onChange={(_, value: TabValue) => setParams(value === 'dados' ? {} : { aba: value }, { replace: true })}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {TABS.map((item) => (
          <Tab key={item.value} value={item.value} label={item.label} />
        ))}
      </Tabs>

      {query.error ? (
        <ErrorMessages error={query.error} />
      ) : !query.data ? (
        <Skeleton variant="rounded" height={240} />
      ) : (
        // A chave remonta o formulário com os valores salvos depois de cada alteração.
        <Box key={query.data.updatedAt + (query.data.branding?.updatedAt ?? '')}>
          {tab === 'dados' && <GeneralTab tenant={query.data} />}
          {tab === 'agenda' && <ScheduleTab tenant={query.data} />}
          {tab === 'marca' && <BrandingTab tenant={query.data} />}
          {tab === 'dominio' && <DomainTab tenant={query.data} />}
          {tab === 'encerrar' && <ClosureTab />}
        </Box>
      )}
    </Box>
  );
}
