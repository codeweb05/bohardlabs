import InboxIcon from '@mui/icons-material/InboxOutlined';
import {Box, Button, Typography} from '@mui/material';

import {useLabels} from '../i18n';

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
      {/* Icon */}
      <Box
        sx={{
          width: {xs: 64, sm: 80},
          height: {xs: 64, sm: 80},
          borderRadius: '50%',
          bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        {icon ?? (
          <InboxIcon
            sx={{
              fontSize: {xs: 32, sm: 40},
              color: 'text.secondary',
            }}
          />
        )}
      </Box>

      {/* Message */}
      <Typography
        variant="h6"
        color="text.primary"
        sx={{
          fontWeight: 600,
          mb: 0.5,
          fontSize: {xs: '1rem', sm: '1.125rem'},
        }}
      >
        {displayMessage}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            maxWidth: 400,
            mb: actionLabel ? 3 : 0,
          }}
        >
          {description}
        </Typography>
      )}

      {/* Action button */}
      {actionLabel && onAction && (
        <Button
          variant="contained"
          onClick={onAction}
          sx={{
            minWidth: 120,
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
