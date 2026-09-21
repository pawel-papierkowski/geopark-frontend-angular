# TODO

## Main task
Finish designing app and determining what we need for required functionality.

## Now
- Issue with using formField directive. It makes difficult to use fields like disabled or invalid.
  Determine if we continue to use FormValueControl or we manually control whole thing. If we preserve FormValueControl, we need to understand how to actually change values of reserved attributes like disabled or invalid and react to it.

## Pending
- Add dev page for custom components. These will be shown in form and with texts representing actual values of these components.
- Add all needed custom components (all with unit/e2e tests, ARIA, keyboard handling etc):
  - RadioBox (ONGOING)
  - TextBox
  - ComboBox

- Add temporary floating messages that allow user feedback on their actions. Apparently, they are called *toasts* or *snackbars*.
  We need separate dev page to test various notifications, including toasts.

- Add indicator that page is working on something. These are called *spinners*.

## Later
- Configure project security-wise (reinforcing against npm chain attacks etc).
