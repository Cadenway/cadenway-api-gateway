# Changelog

## [0.4.0](https://github.com/Cadenway/cadenway-api-gateway/compare/v0.3.0...v0.4.0) (2026-11-21)


### Features

* **account:** serve the account security routes of identity-service ([#30](https://github.com/Cadenway/cadenway-api-gateway/issues/30)) ([30cbbbe](https://github.com/Cadenway/cadenway-api-gateway/commit/30cbbbe6958e7f4e76647540d2666ce6d1303011))
* **auth:** serve two-step verification, its sign-in challenge and the authentication policy ([#32](https://github.com/Cadenway/cadenway-api-gateway/issues/32)) ([1f98a3f](https://github.com/Cadenway/cadenway-api-gateway/commit/1f98a3f25e11ac9aa2b66bf5199b7a80d6826da6))
* **automation:** expose rules and visible execution history ([#47](https://github.com/Cadenway/cadenway-api-gateway/issues/47)) ([60e5789](https://github.com/Cadenway/cadenway-api-gateway/commit/60e57899b04f6e94bd216e315ae74d7f92a60153))
* **billing:** expose the subscription and relay quota refusals ([#44](https://github.com/Cadenway/cadenway-api-gateway/issues/44)) ([c81a652](https://github.com/Cadenway/cadenway-api-gateway/commit/c81a6528351dc46c9e1eb3e42d06875b353ee8c1))
* **documents:** expose verified document operations ([#42](https://github.com/Cadenway/cadenway-api-gateway/issues/42)) ([1115712](https://github.com/Cadenway/cadenway-api-gateway/commit/111571234018265aae8c3ee5fed4ca7fde6720f2))
* **gateway:** expose authenticated task attachments ([#40](https://github.com/Cadenway/cadenway-api-gateway/issues/40)) ([df74931](https://github.com/Cadenway/cadenway-api-gateway/commit/df749316cb0b9a58b2ec60e8e0c2768400d22743))
* **gateway:** expose goals reports and list intake ([#37](https://github.com/Cadenway/cadenway-api-gateway/issues/37)) ([717d782](https://github.com/Cadenway/cadenway-api-gateway/commit/717d782735e3988b6bcf336f9747058a3e834a1a))
* **gateway:** expose the P3c foundation operations ([#36](https://github.com/Cadenway/cadenway-api-gateway/issues/36)) ([9861c8c](https://github.com/Cadenway/cadenway-api-gateway/commit/9861c8c481ee4bad2677f1fef5a528b3f8eba1ed))
* **gateway:** relay public site forms to notification ([#48](https://github.com/Cadenway/cadenway-api-gateway/issues/48)) ([4156faf](https://github.com/Cadenway/cadenway-api-gateway/commit/4156fafb7e36bd47ee1abe419cd1251982cd6ed5))
* **gateway:** route intake attachments and private profile media ([#41](https://github.com/Cadenway/cadenway-api-gateway/issues/41)) ([edbf9c4](https://github.com/Cadenway/cadenway-api-gateway/commit/edbf9c4511c6fb47419b688d3ec9ddf606793d47))
* **notification:** expose inbox, preferences and reminders ([#39](https://github.com/Cadenway/cadenway-api-gateway/issues/39)) ([2430234](https://github.com/Cadenway/cadenway-api-gateway/commit/2430234d4640dd5306df5296494cbd6c42ead019))
* **rate-limit:** limit anonymous requests and failed bearer tokens per client address ([#28](https://github.com/Cadenway/cadenway-api-gateway/issues/28)) ([8b91a8a](https://github.com/Cadenway/cadenway-api-gateway/commit/8b91a8a352426d04746e4f7b0f9467120e67bfcf))
* **realtime:** expose single-use socket tickets ([#38](https://github.com/Cadenway/cadenway-api-gateway/issues/38)) ([4c6e55f](https://github.com/Cadenway/cadenway-api-gateway/commit/4c6e55fac75315b7d9466ae9b442ecb88135b9c2))
* **routes:** serve organizations, members, invitations and api tokens behind scopes ([#26](https://github.com/Cadenway/cadenway-api-gateway/issues/26)) ([08a1257](https://github.com/Cadenway/cadenway-api-gateway/commit/08a12572707187477286c72d6196f164ee3d2052))
* **search:** expose the authorized command palette ([#43](https://github.com/Cadenway/cadenway-api-gateway/issues/43)) ([adda068](https://github.com/Cadenway/cadenway-api-gateway/commit/adda06825f419122d5537c728d714bd8d18602fc))
* **tasks:** expose the task collaboration operations ([#35](https://github.com/Cadenway/cadenway-api-gateway/issues/35)) ([e584044](https://github.com/Cadenway/cadenway-api-gateway/commit/e5840448c6a45f4ace35b4d508ff9197d7875c65))
* **tasks:** serve the access, archive, trash and deletion routes of task-service ([#34](https://github.com/Cadenway/cadenway-api-gateway/issues/34)) ([5e6f46c](https://github.com/Cadenway/cadenway-api-gateway/commit/5e6f46c1de3c3e5d9632630f08d1c6dff8f10ed4))
* **tasks:** serve the task core routes of task-service ([#33](https://github.com/Cadenway/cadenway-api-gateway/issues/33)) ([6b6e113](https://github.com/Cadenway/cadenway-api-gateway/commit/6b6e11346d17da0aa6c26a57c1946211279cb912))
* **webhooks:** relay signed Git deliveries ([#46](https://github.com/Cadenway/cadenway-api-gateway/issues/46)) ([967b458](https://github.com/Cadenway/cadenway-api-gateway/commit/967b4588f02b31ff76e5017fc963b75ac2dcd19e))


### Bug Fixes

* **invitations:** relay the invitation email limits with retry-after ([#29](https://github.com/Cadenway/cadenway-api-gateway/issues/29)) ([89944f4](https://github.com/Cadenway/cadenway-api-gateway/commit/89944f4ecd1964487e3931c1faaad14736a7fc46))
* **tasks:** cancel task detail calls when no longer needed ([#45](https://github.com/Cadenway/cadenway-api-gateway/issues/45)) ([c83ee70](https://github.com/Cadenway/cadenway-api-gateway/commit/c83ee700b12a29dbe00ac95ef19f37ca396c9524))

## [0.3.0](https://github.com/Cadenway/cadenway-api-gateway/compare/v0.2.0...v0.3.0) (2026-11-16)


### Features

* **auth:** serve the authentication routes through identity-service ([#20](https://github.com/Cadenway/cadenway-api-gateway/issues/20)) ([81e38ae](https://github.com/Cadenway/cadenway-api-gateway/commit/81e38ae3265a164f37d197d4ccdb2a23dbcc0eff))
* wire the gateway onto nest-common 0.3.0 ([#18](https://github.com/Cadenway/cadenway-api-gateway/issues/18)) ([f8f2e14](https://github.com/Cadenway/cadenway-api-gateway/commit/f8f2e14d2c53a0ce97c1c1d39c1138b7666dab82))


### Bug Fixes

* **auth:** forward the sign-up password to its verification ([#21](https://github.com/Cadenway/cadenway-api-gateway/issues/21)) ([a7b14bf](https://github.com/Cadenway/cadenway-api-gateway/commit/a7b14bfd3128d5dfbff4105588338b397a99656c))
* **deps:** answer a malformed json body without echoing it ([#22](https://github.com/Cadenway/cadenway-api-gateway/issues/22)) ([06cfa4b](https://github.com/Cadenway/cadenway-api-gateway/commit/06cfa4b90eef1bd2faf08fd2a0f8b1cf217d4f53))

## [0.2.0](https://github.com/Cadenway/cadenway-api-gateway/compare/v0.1.0...v0.2.0) (2026-11-15)


### Features

* wire the gateway onto the service kit ([#16](https://github.com/Cadenway/cadenway-api-gateway/issues/16)) ([c1587de](https://github.com/Cadenway/cadenway-api-gateway/commit/c1587de6f8b3b85a1b9a5870b0fdeac31e6cf464))

## 0.1.0 (2026-11-12)


### Bug Fixes

* **deploy:** sign the deploy commits with the bot's noreply address ([#3](https://github.com/Cadenway/cadenway-api-gateway/issues/3)) ([91a5968](https://github.com/Cadenway/cadenway-api-gateway/commit/91a59682b789f6cdac7a4a707bc88b4ab23b27db))
