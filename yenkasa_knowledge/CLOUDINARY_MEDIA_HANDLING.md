# Cloudinary Media Handling

## Overview

Cloudinary is the primary media delivery path for uploaded images and videos. The backend also rewrites outgoing Cloudinary URLs to improve delivery size and quality automatically.

## Current implementation

### Upload configuration

- file: `config/cloudinary.js`
- configured from:
  - `CLOUDINARY_CLOUD_NAME`
  - `CLOUDINARY_API_KEY`
  - `CLOUDINARY_API_SECRET`
- profile uploads default to folder `yenkasa/profile`

### Response optimization

- file: `utils/cloudinaryMedia.js`
- middleware: `cloudinaryMediaResponseOptimizer`
- rewrites JSON responses containing Cloudinary delivery URLs
- injects:
  - `f_auto`
  - `q_auto`
  - width/crop transforms
- generates a poster image for videos when one is missing

## Important characteristics

- media optimization is applied centrally at `res.json(...)`
- large uploads are audit-logged
- Cloudinary handling is deeply integrated into API response shaping

## Known issues

- response mutation at the framework level can make debugging payloads harder
- media transformations are inferred from field names, which is useful but heuristic

## Scaling concerns

- global JSON response rewriting adds work to every matching API response
- transformation rules are code-driven rather than policy-configured

## Recommended improvements

1. document canonical media field semantics
2. precompute more media derivatives during upload if needed
3. expose media optimization rules in a dedicated configuration module

