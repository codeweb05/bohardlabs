import InboxIcon from '@mui/icons-material/InboxOutlined';
import {Button} from '@mui/material';

import {useLabels} from '../i18n';
import {StatusPanel} from './StatusPanel';

interface EmptyStateProps {
  readonly message?: string;
  readonly description?: string;
  readonly icon?: React.ReactNode;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function EmptyState({message, description, icon, actionLabel, onAction}: Readonly<EmptyStateProps>) {
  const labels = useLabels();
  const displayMessage = message ?? labels.noData;

  return (
    <StatusPanel
      icon={
        icon ?? (
          <InboxIcon
            sx={{
              fontSize: {xs: 32, sm: 40},
              color: 'text.secondary',
            }}
          />
        )
      }
      iconBgcolor="action.hover"
      title={displayMessage}
      description={description}
      action={
        actionLabel && onAction ? (
          <Button variant="contained" onClick={onAction} sx={{mt: 3, minWidth: 120}}>
            {actionLabel}
          </Button>
        ) : undefined
      }
    />
  );
}
