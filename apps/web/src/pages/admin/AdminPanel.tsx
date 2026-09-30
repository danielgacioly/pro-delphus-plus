import { Page, Section } from '../../components/ui'
import { AccountsSection } from './AccountsSection'
import { DangerZone } from './DangerZone'

/** Painel do ADM: contas da equipe e, no fim, as ações permanentes. */
export function AdminPanel() {
  return (
    <Page title="Painel do administrador" description="Contas da equipe e ações que valem para o sistema inteiro.">
      <AccountsSection />
      <Section className="mt-12">
        <DangerZone />
      </Section>
    </Page>
  )
}
