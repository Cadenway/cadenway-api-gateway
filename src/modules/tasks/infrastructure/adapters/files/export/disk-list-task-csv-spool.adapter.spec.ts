import { describe, expect, it } from 'vitest';

import { DiskListTaskCsvSpoolFactory } from './disk-list-task-csv-spool.adapter.js';

describe('DiskListTaskCsvSpoolFactory', () => {
  it('streams indexed UTF-8 rows in the requested order and holds one slot until disposal', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const spool = await factory.open();
    if (spool === null) throw new Error('The first export did not acquire the spool.');
    try {
      await spool.writeHeader('"Nom"\r\n');
      await spool.writeRow('"Zoé"\r\n');
      await spool.writeRow('"Élodie"\r\n');
      const file = spool.finish('sprint.csv', [1, 0]);
      expect(await factory.open()).toBeNull();
      let bytes = 0;
      let result = '';
      for await (const chunk of file.stream()) {
        bytes += chunk.byteLength;
        result += Buffer.from(chunk).toString('utf8');
      }
      expect(bytes).toBe(file.byteLength);
      expect(result).toBe('"Nom"\r\n"Élodie"\r\n"Zoé"\r\n');
      expect(await factory.open()).toBeNull();
      await file.dispose();
    } finally {
      await spool.dispose();
    }
    const next = await factory.open();
    expect(next).not.toBeNull();
    await next?.dispose();
  });

  it('keeps the slot reusable after a download stops reading a prepared file', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const spool = await factory.open();
    if (spool === null) throw new Error('The first export did not acquire the spool.');
    try {
      await spool.writeHeader('"Nom"\r\n');
      await spool.writeRow(`"${'à'.repeat(80_000)}"\r\n`);
      const file = spool.finish('sprint.csv');
      let first: Uint8Array | undefined;
      for await (const chunk of file.stream()) {
        first = chunk;
        break;
      }
      expect(first?.byteLength).toBeLessThan(file.byteLength);
    } finally {
      await spool.dispose();
    }
    const next = await factory.open();
    expect(next).not.toBeNull();
    await next?.dispose();
  });
});
