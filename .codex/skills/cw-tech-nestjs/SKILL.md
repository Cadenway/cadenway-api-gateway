---
name: cw-tech-nestjs
description: "Implement or review NestJS modules, providers, controllers, and application wiring in Cadenway backends."
---

# Nestjs for Cadenway

Read the repository's architectural boundaries, module conventions, and existing Nest testing skill. Services own their domain logic; gateways route, authorize, or aggregate without taking over a service's domain decisions. Follow contract-first APIs and use `@cadenway/nest-common`, `@cadenway/nest-messaging`, and `@cadenway/nest-testing` where the owning repository requires them. Keep business logic out of the shared service kit. Run the narrowest applicable module, integration, and type checks.

Consult the official documentation for the version actually used: https://docs.nestjs.com/.
