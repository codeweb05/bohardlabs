// `ErrorOutlined`, not `ErrorOutline`: the same circle-outline glyph, but v9 of the icon pack
// dropped `ErrorOutline`, and the peer range covers v7 and v9.
import ErrorIcon from '@mui/icons-material/ErrorOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Alert, Button} from '@mui/material';
import {alpha} from '@mui/material/styles';

import {useLabels} from '../i18n';
import {StatusPanel} from './StatusPanel';

interface ErrorStateProps {
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly compact?: boolean;
}

export function ErrorState({error, onRetry, compact = false}: Readonly<ErrorStateProps>) {
  const labels = useLabels();
  const displayError = error ?? labels.error;

  if (compact) {
    return (
      <Alert
        severity="error"
        action={
          onRetry && (
            <Button color="inherit" size="small" onClick={onRetry} startIcon={<RefreshIcon />}>
              {labels.retry}
            </Button>
          )
        }
        sx={{m: 2}}
      >
        {displayError}
      </Alert>
    );
  }

  return (
    <StatusPanel
      icon={
        <ErrorIcon
          sx={{
            fontSize: {xs: 32, sm: 40},
            color: 'error.main',
          }}
        />
      }
      iconBgcolor={(theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.1 : 0.08)}
      title={labels.error}
      titleColor="error.main"
      description={error || undefined}
      action={
        onRetry ? (
          <Button
            variant="outlined"
            color="primary"
            onClick={onRetry}
            startIcon={<RefreshIcon />}
            sx={{mt: 3, minWidth: 120}}
          >
            {labels.retry}
          </Button>
        ) : undefined
      }
    />
  );
}
