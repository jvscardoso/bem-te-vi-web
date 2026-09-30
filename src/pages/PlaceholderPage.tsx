import { PageHeader } from '@/components/PageHeader';
import { StatusScreen } from '@/components/StatusScreen';

/** Tela provisória para módulos ainda não implementados. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <StatusScreen title="Em construção" description="Este módulo será entregue nas próximas etapas." />
    </>
  );
}
