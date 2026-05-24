# Future SSO Plan

The current identity layer is intentionally product-neutral:

- user ids are independent of any single app
- roles are shared and extensible
- sessions and YME events already carry `source`-style metadata
- analytics aggregate by user, not by a single frontend

To evolve this into ecosystem SSO:

1. move JWT issuance behind a central identity service
2. split product-specific preferences from shared profile metadata
3. attach wallet identity and verification state
4. expose token introspection for all Yenkasa apps
5. feed cross-product YME events into a shared intelligence graph
