import type { Action, Product } from '../types'
import ActionEntry from './ActionEntry'
import { useT } from '../context/LocaleContext'

type Props = {
  actions: Action[]
  products: Product[]
  onEdit?: (action: Action) => void
}

export default function Timeline({ actions, products, onEdit }: Props) {
  const { t } = useT()
  return (
    <table className="history-table">
      <thead>
        <tr>
          <th>{t('table_date')}</th>
          <th>{t('table_type')}</th>
          <th>{t('table_detail')}</th>
          <th>{t('table_notes')}</th>
          <th style={{ width: 36 }}></th>
        </tr>
      </thead>
      <tbody>
        {actions.map(action => (
          <ActionEntry key={action.id} action={action} products={products} onEdit={onEdit} />
        ))}
      </tbody>
    </table>
  )
}
