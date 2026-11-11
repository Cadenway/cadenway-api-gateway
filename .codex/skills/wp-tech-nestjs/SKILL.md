---
name: wp-tech-nestjs
description: "Implement or review NestJS modules, providers, controllers, and application wiring in Waypoint backends."
---

# Nestjs for Waypoint

Read the repository's architectural boundaries, module conventions, and existing Nest testing skill. Services own their domain logic; gateways route, authorize, or aggregate without taking over a service's domain decisions. Follow contract-first APIs and use `@waypoint/nest-common`, `@waypoint/nest-messaging`, and `@waypoint/nest-testing` where the owning repository requires them. Keep business logic out of the shared service kit. Run the narrowest applicable module, integration, and type checks.

Consult the official documentation for the version actually used: https://docs.nestjs.com/.
