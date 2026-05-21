import 'package:flutter/material.dart';

import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../services/mock_dashboard_data.dart';

class AnalyticsPage extends StatelessWidget {
  const AnalyticsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          eyebrow: 'System Analytics',
          title:
              'Latency, request volume, retrieval readiness, and health signals',
          description:
              'This is structured for future live dashboards without changing the current UI shell. The cards below are mock metrics shaped like the production backend should serve.',
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 16,
          runSpacing: 16,
          children: analyticsMetrics
              .map(
                (metric) => SizedBox(
                  width: 220,
                  child: MetricCard(
                    label: metric.label,
                    value: metric.value,
                    note: metric.note,
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 20),
        GlassCard(
          strong: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Latency profile',
                style: Theme.of(
                  context,
                ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: const [
                  SizedBox(
                    width: 240,
                    child: MetricCard(
                      label: 'Retrieval median',
                      value: '412ms',
                      note: 'Top-k search on Chroma',
                    ),
                  ),
                  SizedBox(
                    width: 240,
                    child: MetricCard(
                      label: 'Generation median',
                      value: '1.48s',
                      note: 'Vertex AI Gemini 2.5 Flash',
                    ),
                  ),
                  SizedBox(
                    width: 240,
                    child: MetricCard(
                      label: 'Cold start',
                      value: '29.2s',
                      note: 'Cloud Run startup path',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}
