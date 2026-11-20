import { describe, expect, it, vi } from 'vitest';

import type { ProfileMediaPort } from '../../ports/outbound/services/profile-media/profile-media.port.js';
import { ProfileMediaService } from './profile-media.service.js';

function fixture() {
  const uploadId = '019a7003-4d5e-7f6a-8b9c-0d1e2f3a4b01';
  const expiresAt = '2026-11-20T12:05:00Z';
  const port = {
    reserveAvatar: vi.fn().mockResolvedValue({ uploadId, expiresAt }),
    reserveLogo: vi.fn().mockResolvedValue({ uploadId, expiresAt }),
    avatarReservation: vi.fn().mockResolvedValue({ uploadId, expiresAt, state: 'pending' }),
    logoReservation: vi.fn().mockResolvedValue({ uploadId, expiresAt, state: 'pending' }),
    sign: vi.fn().mockResolvedValue({
      uploadId,
      expiresAt,
      method: 'POST',
      url: 'https://files.example.test',
      fields: { key: 'fixture' },
    }),
    prepare: vi.fn().mockResolvedValue(undefined),
    setAvatar: vi.fn().mockResolvedValue('"2"'),
    setLogo: vi.fn().mockResolvedValue('"2"'),
    deleteAvatar: vi.fn().mockResolvedValue('"2"'),
    deleteLogo: vi.fn().mockResolvedValue('"2"'),
    avatarReference: vi.fn().mockResolvedValue(uploadId),
    logoReference: vi.fn().mockResolvedValue(uploadId),
    memberUserId: vi.fn().mockResolvedValue('account'),
    avatarImage: vi.fn().mockResolvedValue(Buffer.from('png')),
    logoImage: vi.fn().mockResolvedValue(Buffer.from('png')),
  } satisfies ProfileMediaPort;
  return { useCase: new ProfileMediaService(port), port, uploadId, expiresAt };
}

describe('profile media orchestration', () => {
  it('signs only after the owner reserves and reuses its identity and expiry', async () => {
    const { useCase, port, uploadId, expiresAt } = fixture();
    const declaration = { contentType: 'image/png' as const, sizeBytes: 100 };
    await useCase.startAvatar('account', declaration, 'key');
    expect(port.reserveAvatar).toHaveBeenCalledWith('account', declaration, 'key');
    expect(port.sign).toHaveBeenCalledWith(uploadId, 'avatar', expiresAt, declaration);
    expect(vi.mocked(port.reserveAvatar).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(port.sign).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('prepares pending uploads but lets the owner handle committed replay', async () => {
    const { useCase, port, uploadId, expiresAt } = fixture();
    await expect(useCase.setAvatar('account', uploadId, '"1"')).resolves.toBe('"2"');
    expect(port.prepare).toHaveBeenCalledWith(uploadId, 'avatar');
    vi.mocked(port.logoReservation).mockResolvedValueOnce({
      uploadId,
      expiresAt,
      state: 'committed',
    });
    await expect(useCase.setLogo(uploadId, '"1"')).resolves.toBe('"2"');
    expect(port.prepare).toHaveBeenCalledTimes(1);
    expect(port.setLogo).toHaveBeenCalledWith(uploadId, '"1"');
  });

  it('never prepares when the owning service denies the reservation', async () => {
    const { useCase, port, uploadId } = fixture();
    const denied = new Error('denied');
    vi.mocked(port.avatarReservation).mockRejectedValueOnce(denied);
    await expect(useCase.setAvatar('account', uploadId)).rejects.toBe(denied);
    expect(port.prepare).not.toHaveBeenCalled();
    expect(port.setAvatar).not.toHaveBeenCalled();
  });

  it('resolves member access and the current reference before the private image', async () => {
    const { useCase, port, uploadId } = fixture();
    await useCase.getMemberAvatar('member');
    expect(port.memberUserId).toHaveBeenCalledWith('member');
    expect(port.avatarReference).toHaveBeenCalledWith('account');
    expect(port.avatarImage).toHaveBeenCalledWith(uploadId, 'account', true);
    expect(vi.mocked(port.memberUserId).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(port.avatarReference).mock.invocationCallOrder[0] ?? 0,
    );
    expect(vi.mocked(port.avatarReference).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(port.avatarImage).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not read Storage when the current reference is absent', async () => {
    const { useCase, port } = fixture();
    vi.mocked(port.logoReference).mockResolvedValueOnce(null);
    await expect(useCase.getLogo()).resolves.toBeNull();
    expect(port.logoImage).not.toHaveBeenCalled();
  });
});
