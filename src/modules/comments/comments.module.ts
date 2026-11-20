import { Module } from '@nestjs/common';
import { ClientsModule } from '../../clients/clients.module.js';
import { TaskServiceClient } from '../../clients/task-service.client.js';
import { AuthModule } from '../auth/auth.module.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';
import type { CommentsRegistry } from './application/ports/outbound/task-service/comments/comments-registry.port.js';
import { createCommentsRegistry } from './infrastructure/adapters/task-service/comments-registry.adapter.js';
import { CommentsController } from './presentation/http/controllers/comments/comments.controller.js';
import { ListTaskComments } from './application/use-cases/queries/comments/list-task-comments/list-task-comments.use-case.js';
import { CreateTaskComment } from './application/use-cases/commands/comments/create-task-comment/create-task-comment.use-case.js';
import { GetTaskComment } from './application/use-cases/queries/comments/get-task-comment/get-task-comment.use-case.js';
import { UpdateTaskComment } from './application/use-cases/commands/comments/update-task-comment/update-task-comment.use-case.js';
import { DeleteTaskComment } from './application/use-cases/commands/comments/delete-task-comment/delete-task-comment.use-case.js';
import { ListTaskParticipants } from './application/use-cases/queries/comments/list-task-participants/list-task-participants.use-case.js';

/** Injection token for the task-service port. */
const REGISTRY = Symbol('CommentsRegistry');

/** Wires the public comments capability. */
@Module({
  imports: [ClientsModule, AuthModule, RateLimitModule],
  controllers: [CommentsController],
  providers: [
    { provide: REGISTRY, inject: [TaskServiceClient], useFactory: createCommentsRegistry },
    {
      provide: ListTaskComments,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): ListTaskComments => new ListTaskComments(registry),
    },
    {
      provide: CreateTaskComment,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): CreateTaskComment =>
        new CreateTaskComment(registry),
    },
    {
      provide: GetTaskComment,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): GetTaskComment => new GetTaskComment(registry),
    },
    {
      provide: UpdateTaskComment,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): UpdateTaskComment =>
        new UpdateTaskComment(registry),
    },
    {
      provide: DeleteTaskComment,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): DeleteTaskComment =>
        new DeleteTaskComment(registry),
    },
    {
      provide: ListTaskParticipants,
      inject: [REGISTRY],
      useFactory: (registry: CommentsRegistry): ListTaskParticipants =>
        new ListTaskParticipants(registry),
    },
  ],
})
export class CommentsModule {}
