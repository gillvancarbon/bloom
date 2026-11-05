# Security policy

## Supported versions

The latest released version receives security fixes. Older builds may not.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use
GitHub's private vulnerability reporting on this repository
(**Security → Report a vulnerability**), or email the maintainer listed on the
repository profile.

Please include:

- what the issue is and how it can be triggered,
- the version or commit you tested,
- steps to reproduce, and
- any suggested fix, if you have one.

You'll get an acknowledgement as soon as possible, and credit in the fix notes
unless you prefer to stay anonymous.

## Scope

Bloom is a local-first app: the Android build keeps all data on the device and
makes no network requests. The optional web back-end has **no authentication by
default**, so it should only be run on a trusted, private network — do not expose
it to the public internet as-is.
