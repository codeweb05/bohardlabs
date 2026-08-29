import {Box, Typography} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import type {ReactNode} from 'react';

interface StatusPanelProps {
  readonly icon: ReactNode;
  readonly iconBgcolor: string | ((theme: Theme) => string);
  readonly title: string;
  readonly titleColor?: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

/**
 * Centered empty/error shell: icon in a circle, title, optional description and action.
 * The action carries its own top margin, so the gap holds when there is no description.
 */
export function StatusPanel({
  icon,
  iconBgcolor,
  title,
  titleColor = 'text.primary',
  description,
  action,
}: Readonly<StatusPanelProps>) {
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
      <Box
        sx={{
          width: {xs: 64, sm: 80},
          height: {xs: 64, sm: 80},
          borderRadius: '50%',
          bgcolor: iconBgcolor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        {icon}
      </Box>

      <Typography
        variant="h6"
        sx={{
          color: titleColor,
          fontWeight: 600,
          mb: 0.5,
          fontSize: {xs: '1rem', sm: '1.125rem'},
        }}
      >
        {title}
      </Typography>

      {description && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            maxWidth: 400,
          }}
        >
          {description}
        </Typography>
      )}

      {action}
    </Box>
  );
}
