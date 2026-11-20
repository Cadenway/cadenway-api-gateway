import { mkdtemp, open, rm, rmdir, unlink, type FileHandle } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ListTaskCsv } from '../../../../application/models/export/list-task-csv.model.js';
import type { ListTaskCsvSpoolFactory } from '../../../../application/ports/outbound/files/export/list-task-csv-spool-factory.port.js';
import type { ListTaskCsvSpool } from '../../../../application/ports/outbound/files/export/list-task-csv-spool.port.js';

const FILE_CAPACITY = 1024 ** 3;

interface FileRange {
  // #region Properties
  /** The inclusive start of the range in the file. */
  readonly offset: number;

  /** The number of initialized bytes in the range. */
  readonly length: number;
  // #endregion
}

/** One private export file, unlinked as soon as supported by the platform. */
export class DiskListTaskCsvSpoolFactory implements ListTaskCsvSpoolFactory {
  // #region Properties
  /** Holds the single export slot through preparation and download. */
  private occupied = false;
  // #endregion

  // #region Methods
  /** Acquires the process's export slot before any filesystem or upstream work. */
  public async open(): Promise<ListTaskCsvSpool | null> {
    if (this.occupied) return null;
    this.occupied = true;
    let directory: string | undefined;
    let filename: string | undefined;
    let handle: FileHandle | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), 'cadenway-csv-'));
      filename = join(directory, 'export');
      handle = await open(filename, 'wx+', 0o600);
      if (process.platform !== 'win32') {
        await unlink(filename);
        filename = undefined;
        await rmdir(directory);
        directory = undefined;
      }
      return new DiskListTaskCsvSpool(handle, filename, directory, () => {
        this.occupied = false;
      });
    } catch (error) {
      try {
        await releaseFile(handle, filename, directory);
      } finally {
        this.occupied = false;
      }
      throw error;
    }
  }
  // #endregion
}

/** Tracks only byte offsets and writes the complete, bounded UTF-8 document to disk. */
class DiskListTaskCsvSpool implements ListTaskCsvSpool {
  // #region Properties
  /** Byte range of the header before any indexed rows. */
  private header: FileRange = { offset: 0, length: 0 };

  /** Byte ranges of rows in source order. */
  private readonly rows: FileRange[] = [];

  /** Total bytes successfully written. */
  private offset = 0;

  /** Shared completion of the idempotent cleanup. */
  private disposed: Promise<void> | undefined;
  // #endregion

  // #region Constructor
  /** Takes ownership of the private file and its reserved slot. */
  public constructor(
    private readonly handle: FileHandle,
    private readonly filename: string | undefined,
    private readonly directory: string | undefined,
    private readonly releaseSlot: () => void,
  ) {}
  // #endregion

  // #region Methods
  /** Writes the first CSV record, separate from the sorted row index. */
  public async writeHeader(line: string, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    const buffer = Buffer.from(line, 'utf8');
    const offset = this.offset;
    await this.append(buffer, signal);
    this.header = { offset, length: buffer.length };
  }

  /** Appends a bounded batch in one write when accepted and indexes every row. */
  public async writeRows(lines: readonly string[], signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    let nextOffset = this.offset;
    const ranges = lines.map((line): FileRange => {
      const length = Buffer.byteLength(line, 'utf8');
      const range = { offset: nextOffset, length };
      nextOffset += length;
      return range;
    });
    if (nextOffset > FILE_CAPACITY) throw new Error('The export spool is full.');
    const buffer = Buffer.allocUnsafe(nextOffset - this.offset);
    let encoded = 0;
    for (const line of lines) {
      signal.throwIfAborted();
      encoded += buffer.write(line, encoded, 'utf8');
    }
    if (encoded !== buffer.length) throw new Error('The export spool could not encode its batch.');
    await this.append(buffer, signal);
    this.rows.push(...ranges);
  }

  /** Returns the prepared document without copying its file contents. */
  public finish(filename: string, order?: readonly number[]): ListTaskCsv {
    return {
      filename,
      byteLength: this.offset,
      stream: () => this.stream(order),
      dispose: () => this.dispose(),
    };
  }

  /** Discards the private file and releases the reserved slot once. */
  public dispose(): Promise<void> {
    return (this.disposed ??= releaseFile(this.handle, this.filename, this.directory).finally(
      this.releaseSlot,
    ));
  }

  /** Completes short writes without exceeding the original byte limit or ignoring cancellation. */
  private async append(buffer: Buffer, signal: AbortSignal): Promise<void> {
    if (this.offset + buffer.length > FILE_CAPACITY) throw new Error('The export spool is full.');
    for (let written = 0; written < buffer.length;) {
      signal.throwIfAborted();
      const { bytesWritten } = await this.handle.write(
        buffer,
        written,
        buffer.length - written,
        this.offset,
      );
      if (bytesWritten === 0) throw new Error('The export spool did not accept a write.');
      written += bytesWritten;
      this.offset += bytesWritten;
    }
    signal.throwIfAborted();
  }

  /** Streams the file directly for ordinary sorts and visits one indexed row at a time for people. */
  private async *stream(order?: readonly number[]): AsyncGenerator<Uint8Array> {
    if (order === undefined) {
      yield* this.handle.createReadStream({ start: 0, end: this.offset - 1, autoClose: false });
      return;
    }
    yield await this.read(this.header);
    for (const index of order) {
      const range = this.rows[index];
      if (range === undefined) throw new Error('The export spool has no indexed row.');
      yield await this.read(range);
    }
  }

  /** Reads one complete indexed range even when the operating system returns a short read. */
  private async read(range: FileRange): Promise<Buffer> {
    const data = Buffer.allocUnsafe(range.length);
    let read = 0;
    while (read < range.length) {
      const { bytesRead } = await this.handle.read(
        data,
        read,
        range.length - read,
        range.offset + read,
      );
      if (bytesRead === 0) throw new Error('The export spool was truncated.');
      read += bytesRead;
    }
    return data;
  }
  // #endregion
}

/** Attempts each cleanup step in order and releases paths before returning the slot. */
async function releaseFile(
  handle: FileHandle | undefined,
  filename: string | undefined,
  directory: string | undefined,
): Promise<void> {
  try {
    await handle?.close();
  } finally {
    try {
      if (filename !== undefined) await rm(filename, { force: true });
    } finally {
      if (directory !== undefined) await rmdir(directory);
    }
  }
}
