import { Module, type FactoryProvider } from '@nestjs/common';

import { ClientsModule } from '../../clients/clients.module.js';
import { IdentityServiceClient } from '../../clients/identity-service.client.js';
import { OrganizationServiceClient } from '../../clients/organization-service.client.js';
import { StorageServiceClient } from '../../clients/storage-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { ProfileMediaPort } from './application/ports/outbound/services/profile-media/profile-media.port.js';
import { ProfileMediaService } from './application/services/profile-media/profile-media.service.js';
import { StartAvatar } from './application/use-cases/commands/profile-media/start-avatar/start-avatar.use-case.js';
import { SetAvatar } from './application/use-cases/commands/profile-media/set-avatar/set-avatar.use-case.js';
import { DeleteAvatar } from './application/use-cases/commands/profile-media/delete-avatar/delete-avatar.use-case.js';
import { StartLogo } from './application/use-cases/commands/profile-media/start-logo/start-logo.use-case.js';
import { SetLogo } from './application/use-cases/commands/profile-media/set-logo/set-logo.use-case.js';
import { DeleteLogo } from './application/use-cases/commands/profile-media/delete-logo/delete-logo.use-case.js';
import { GetAvatar } from './application/use-cases/queries/profile-media/get-avatar/get-avatar.use-case.js';
import { GetLogo } from './application/use-cases/queries/profile-media/get-logo/get-logo.use-case.js';
import { GetMemberAvatar } from './application/use-cases/queries/profile-media/get-member-avatar/get-member-avatar.use-case.js';
import { createProfileMediaAdapter } from './infrastructure/adapters/profile-media/profile-media.adapter.js';
import { ProfileMediaController } from './presentation/http/controllers/profile-media/profile-media.controller.js';

const PROFILE_MEDIA = Symbol('ProfileMediaPort');
const PROVIDERS: readonly FactoryProvider[] = [
  {
    provide: PROFILE_MEDIA,
    inject: [IdentityServiceClient, OrganizationServiceClient, StorageServiceClient],
    useFactory: createProfileMediaAdapter,
  },
  {
    provide: ProfileMediaService,
    inject: [PROFILE_MEDIA],
    useFactory: (media: ProfileMediaPort): ProfileMediaService => new ProfileMediaService(media),
  },
  {
    provide: StartAvatar,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): StartAvatar => new StartAvatar(media),
  },
  {
    provide: SetAvatar,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): SetAvatar => new SetAvatar(media),
  },
  {
    provide: DeleteAvatar,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): DeleteAvatar => new DeleteAvatar(media),
  },
  {
    provide: StartLogo,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): StartLogo => new StartLogo(media),
  },
  {
    provide: SetLogo,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): SetLogo => new SetLogo(media),
  },
  {
    provide: DeleteLogo,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): DeleteLogo => new DeleteLogo(media),
  },
  {
    provide: GetAvatar,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): GetAvatar => new GetAvatar(media),
  },
  {
    provide: GetLogo,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): GetLogo => new GetLogo(media),
  },
  {
    provide: GetMemberAvatar,
    inject: [ProfileMediaService],
    useFactory: (media: ProfileMediaService): GetMemberAvatar => new GetMemberAvatar(media),
  },
];

/** Public media routes and their independently scoped service clients. */
@Module({
  imports: [AuthModule, RateLimitModule, ClientsModule],
  controllers: [ProfileMediaController],
  providers: [...PROVIDERS],
})
export class ProfileMediaModule {}
