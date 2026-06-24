# Design System Spec

Project: `sdd/design-system/`

This document maps the visual design decisions captured from the human. The Designer uses it to build `sdd/design-system/design-system.lib.pen`.

## Design Tokens

| Token | Value | Usage |
|---|---|---|
| Primary | `#3B82F6` | Buttons, links, active states |
| Accent | `#F59E0B` | Highlights, badges |
| Background | `#FFFFFF` | Page background |
| Surface | `#F8FAFC` | Cards, panels |
| Text | `#111827` | Headings, body text |
| Text secondary | `#6B7280` | Captions, placeholders |
| Success | `#22C55E` | Success messages |
| Warning | `#EAB308` | Warnings |
| Error | `#EF4444` | Errors, destructive actions |
| Font | `Inter` | All UI text (single font only) |
| Spacing unit | `4px` | Margins, paddings, gaps |

## Radius Scale

| Name | Value |
|---|---|
| none | 0 |
| small | 4px |
| base | 8px |
| medium | 12px |
| large | 16px |
| full | 9999px |

## Primitive Components

Each component is a reusable `frame` in Pencil with states: default, hover, active, disabled, focus, error, success.

| Component | Used for | Notes |
|---|---|---|
| Button | Primary actions | Primary/secondary/ghost variants |
| Input | Text input | With label, placeholder, error state |
| Card | Content containers | Shadow, radius |
| Modal | Overlays | Backdrop, close button |
| Sheet | Side panels | Slide from edge |
| Avatar | User images | Fallback initials |
| Badge | Status labels | Primary/accent/error variants |
| Loading | Loading states | Spinner/skeleton |

## Decisions

- Single font family: `Inter`.
- Base spacing unit: `4px`.
- Shadow style: ...
