import ErrorIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import {Alert, Box, Button, Typography} from '@mui/material';

import {useLabels} from '../i18n';

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: {xs: 6, sm: 8, md: 10},
        px: 2,
        textAlign: 'center',
      }}
    >
      {/* Error icon */}
      <Box
        sx={{
          width: {xs: 64, sm: 80},
          height: {xs: 64, sm: 80},
          borderRadius: '50%',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.08)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <ErrorIcon
          sx={{
            fontSize: {xs: 32, sm: 40},
            color: 'error.main',
          }}
        />
      </Box>

      {/* Error title */}
      <Typography
        variant="h6"
        color="error.main"
        sx={{
          fontWeight: 600,
          mb: 0.5,
          fontSize: {xs: '1rem', sm: '1.125rem'},
        }}
      >
        {labels.error}
      </Typography>

      {/* Error message. Only when the server sent one: the heading above is already the
          generic message, so falling back here prints it twice, stacked. */}
      {error && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            maxWidth: 400,
          }}
        >
          {error}
        </Typography>
      )}

      {/* Retry button */}
      {onRetry && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onRetry}
          startIcon={<RefreshIcon />}
          sx={{
            minWidth: 120,
            mt: 3,
          }}
        >
          {labels.retry}
        </Button>
      )}
    </Box>
  );
}
