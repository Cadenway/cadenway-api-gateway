import { describe, expect, it } from 'vitest';

import { DiskListTaskCsvSpoolFactory } from './disk-list-task-csv-spool.adapter.js';

describe('DiskListTaskCsvSpoolFactory', () => {
  it('keeps one slot per organization and bounds the process-wide allocation', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const first = await factory.open('first-organization');
    const second = await factory.open('second-organization');
    try {
      expect(first).not.toBeNull();
      expect(second).not.toBeNull();
      expect(await factory.open('FIRST-ORGANIZATION')).toBeNull();
      expect(await factory.open('third-organization')).toBeNull();
      await first?.dispose();
      const third = await factory.open('third-organization');
      expect(third).not.toBeNull();
      await third?.dispose();
    } finally {
      await first?.dispose();
      await second?.dispose();
    }
  });

  it('streams indexed UTF-8 rows in the requested order and holds one slot until disposal', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const spool = await factory.open('organization-id');
    if (spool === null) throw new Error('The first export did not acquire the spool.');
    const { signal } = new AbortController();
    try {
      await spool.writeHeader('"Nom"\r\n', signal);
      await spool.writeRows(['"Zoé"\r\n', '"Élodie"\r\n'], signal);
      await spool.writeRows(['"Léa"\r\n'], signal);
      const file = spool.finish('sprint.csv', [2, 1, 0]);
      expect(await factory.open('organization-id')).toBeNull();
      let bytes = 0;
      let result = '';
      for await (const chunk of file.stream()) {
        bytes += chunk.byteLength;
        result += Buffer.from(chunk).toString('utf8');
      }
      expect(bytes).toBe(file.byteLength);
      expect(result).toBe('"Nom"\r\n"Léa"\r\n"Élodie"\r\n"Zoé"\r\n');
      expect(await factory.open('organization-id')).toBeNull();
      await file.dispose();
    } finally {
      await spool.dispose();
    }
    const next = await factory.open('organization-id');
    expect(next).not.toBeNull();
    await next?.dispose();
  });

  it('keeps the slot reusable after a download stops reading a prepared file', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const spool = await factory.open('organization-id');
    if (spool === null) throw new Error('The first export did not acquire the spool.');
    const { signal } = new AbortController();
    try {
      await spool.writeHeader('"Nom"\r\n', signal);
      await spool.writeRows([`"${'à'.repeat(80_000)}"\r\n`], signal);
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
    const next = await factory.open('organization-id');
    expect(next).not.toBeNull();
    await next?.dispose();
  });

  it('does not append a batch when its signal has already been aborted', async () => {
    const factory = new DiskListTaskCsvSpoolFactory();
    const spool = await factory.open('organization-id');
    if (spool === null) throw new Error('The first export did not acquire the spool.');
    try {
      const controller = new AbortController();
      await spool.writeHeader('"Nom"\r\n', controller.signal);
      controller.abort();
      await expect(
        spool.writeRows(['"Zoé"\r\n', '"Élodie"\r\n'], controller.signal),
      ).rejects.toMatchObject({
        name: 'AbortError',
      });
      expect(spool.finish('sprint.csv').byteLength).toBe(Buffer.byteLength('"Nom"\r\n'));
    } finally {
      await spool.dispose();
    }
  });
});
