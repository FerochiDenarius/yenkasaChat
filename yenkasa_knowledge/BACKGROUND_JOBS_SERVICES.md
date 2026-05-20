# Background Jobs and Services

## Overview

Yenkasa runs scheduled and reusable backend jobs in-process. These jobs support verification, ranking, monthly reward resets, notifications, privacy, and monetization analytics.

## Scheduled jobs

### Daily verification scheduler

- file: `services/verificationScheduler.js`
- cadence: daily at midnight Africa/Accra
- work:
  - update app verification records
  - compute user performance metrics
  - issue daily activity rewards
  - sync rank/phase progression

### Monthly YKC reset

- file: `services/ykcMonthlyReset.js`
- cadence: first day of each month
- work:
  - snapshot prior month YKC state
  - reset monthly counters on user records

## Shared services

- `notification.service.js`
- `communityPostNotification.service.js`
- `reward.service.js`
- `ykcEconomy.service.js`
- `ranking.service.js`
- `regionalRewards.service.js`
- `privacy.service.js`
- `userPerformanceMetrics.js`
- monetization and revenue analytics services

## Known issues

- scheduled work runs in the same process as web traffic
- daily jobs iterate the full user set
- service boundaries are useful but still loose; route handlers often orchestrate several services directly

## Scaling concerns

- full-user scans will eventually become too expensive for a single process midnight job
- worker crashes or deploy restarts can interrupt jobs without a durable queue

## Recommended improvements

1. move cron-driven work to a separate worker process
2. add job checkpoints and metrics
3. partition full-user jobs into batches or queues

