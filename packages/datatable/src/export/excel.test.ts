/**
 * The Excel wrapper, against a stand-in for `write-excel-file`.
 *
 * The stories run the real library in a browser and check that a file comes out. What they
 * cannot see is what the wrapper hands the library, and that is where its one piece of
 * logic sits: `ExcelCell` allows `null` for an empty cell, the library does not, so a null
 * has to arrive as "no value" or the library throws on the first blank field of a sheet.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {createDataRow, createHeaderRow, writeExcelFile} from './excel';

const library = vi.hoisted(() => {
  const toFile = vi.fn<(fileName: string) => Promise<void>>();
  const write = vi.fn<(rows: unknown, options: unknown) => {toFile: typeof toFile}>(() => ({toFile}));
  return {toFile, write};
});

vi.mock('write-excel-file/browser', () => ({default: library.write}));

beforeEach(() => {
  library.toFile.mockReset().mockResolvedValue(undefined);
  library.write.mockClear();
});

describe('writeExcelFile', () => {
  it('hands an empty cell to the library as no value', async () => {
    await writeExcelFile(
      [
        [{value: 'Name', fontWeight: 'bold'}, {value: 'Note'}],
        [{value: 'Ada'}, {value: null}],
      ],
      {fileName: 'people.xlsx'},
    );

    expect(library.write).toHaveBeenCalledExactlyOnceWith(
      [
        [
          {value: 'Name', fontWeight: 'bold'},
          {value: 'Note', fontWeight: undefined},
        ],
        [
          {value: 'Ada', fontWeight: undefined},
          {value: undefined, fontWeight: undefined},
        ],
      ],
      {sheet: 'Sheet1'},
    );
    expect(library.toFile).toHaveBeenCalledExactlyOnceWith('people.xlsx');
  });

  it('keeps zero and false, which are values and not blanks', async () => {
    await writeExcelFile([[{value: 0}, {value: false}]], {fileName: 'flags.xlsx'});

    expect(library.write.mock.calls[0]?.[0]).toEqual([
      [
        {value: 0, fontWeight: undefined},
        {value: false, fontWeight: undefined},
      ],
    ]);
  });

  it('passes the sheet name and the column widths through', async () => {
    await writeExcelFile([createHeaderRow(['Name']), createDataRow(['Ada'])], {
      fileName: 'people.xlsx',
      sheetName: 'People',
      columns: [{width: 12}],
    });

    expect(library.write.mock.calls[0]?.[1]).toEqual({sheet: 'People', columns: [{width: 12}]});
  });
});
