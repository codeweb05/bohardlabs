import {Box, Skeleton, Table, TableBody, TableCell, TableHead, TableRow} from '@mui/material';

import {useLabels} from '../i18n';

interface LoadingStateProps {
  readonly columns?: number;
  readonly rows?: number;
  readonly message?: string;
  readonly density?: 'compact' | 'comfortable' | 'spacious';
}

const ROW_HEIGHT_BY_DENSITY: Record<NonNullable<LoadingStateProps['density']>, number> = {
  compact: 36,
  comfortable: 52,
  spacious: 64,
};

export function LoadingState({columns = 5, rows = 5, message, density = 'comfortable'}: Readonly<LoadingStateProps>) {
  const labels = useLabels();
  const displayMessage = message ?? labels.loading;

  const rowHeight = ROW_HEIGHT_BY_DENSITY[density];

  return (
    <Box sx={{width: '100%', position: 'relative'}}>
      {/* Overlay message. The only part of this state a screen reader should reach: it is
          announced when loading starts, and the skeleton below it is decoration. */}
      <Box
        role="status"
        aria-live="polite"
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1,
          bgcolor: 'background.paper',
          px: 3,
          py: 1.5,
          borderRadius: 1,
          boxShadow: 2,
        }}
      >
        {displayMessage}
      </Box>

      {/* Skeleton table. Hidden from assistive technology: its header cells hold a
          shimmer and no text, which reads as a table with unlabelled columns. */}
      <Table aria-hidden>
        <TableHead>
          <TableRow>
            {Array.from({length: columns}).map((_, index) => (
              <TableCell key={`header-${index}`}>
                <Skeleton variant="text" width={index === 0 ? 40 : '80%'} height={20} animation="wave" />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({length: rows}).map((_, rowIndex) => (
            <TableRow key={`row-${rowIndex}`} sx={{height: rowHeight}}>
              {Array.from({length: columns}).map((__, colIndex) => {
                // Deterministic width variation so the skeleton looks natural without using a PRNG.
                const widthPercent = 60 + ((rowIndex * 7 + colIndex * 13) % 30);
                return (
                  <TableCell key={`cell-${rowIndex}-${colIndex}`}>
                    <Skeleton
                      variant="text"
                      width={colIndex === 0 ? 32 : `${widthPercent}%`}
                      height={16}
                      animation="wave"
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
