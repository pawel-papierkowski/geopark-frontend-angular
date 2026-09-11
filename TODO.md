# TODO

## Main task
Finish designing app and determining what we need for required functionality.

## Now
- Install and configure PlayWright.

## Pending
- Add simple nav component, separate for public, admin and dev so header is different depending on section.
- We might need to unify `public-layout`, `dev-layout` and `admin-layout`. If so, create new `section-layout`.
  One thing to consider: public layout could be significantly different than other two, as it is supposed to be user-facing page, so fancier and with graphics etc. Admin and dev, on other hand, are purely functional.
  Though with CSS magic we could generate significantly differently looking layout even with same fundamental base... but that still requires different css class for different layout. Think on it more.

## Later
