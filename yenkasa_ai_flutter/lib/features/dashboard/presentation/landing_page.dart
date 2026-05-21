import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/app_logo.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../services/mock_dashboard_data.dart';

class LandingPage extends StatelessWidget {
  const LandingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFFF8F6FF), Color(0xFFF3EEFF), Color(0xFFF7F8FF)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 1480),
                child: Column(
                  children: [
                    GlassCard(
                      strong: true,
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final compactHeader = constraints.maxWidth < 720;
                          return compactHeader
                              ? Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const AppLogo(),
                                    const SizedBox(height: 18),
                                    SizedBox(
                                      width: double.infinity,
                                      child: FilledButton(
                                        onPressed: () => context.go('/chat'),
                                        child: const Text('Launch YenkasaAI'),
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    SizedBox(
                                      width: double.infinity,
                                      child: OutlinedButton(
                                        onPressed: () =>
                                            context.go('/knowledge'),
                                        child: const Text('Explore APIs'),
                                      ),
                                    ),
                                  ],
                                )
                              : Row(
                                  children: [
                                    const Expanded(child: AppLogo()),
                                    Wrap(
                                      spacing: 12,
                                      runSpacing: 12,
                                      children: [
                                        FilledButton(
                                          onPressed: () => context.go('/chat'),
                                          child: const Text('Launch YenkasaAI'),
                                        ),
                                        OutlinedButton(
                                          onPressed: () =>
                                              context.go('/knowledge'),
                                          child: const Text('Explore APIs'),
                                        ),
                                      ],
                                    ),
                                  ],
                                );
                        },
                      ),
                    ),
                    const SizedBox(height: 22),
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final wide = constraints.maxWidth > 1100;
                        return Flex(
                          direction: wide ? Axis.horizontal : Axis.vertical,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: wide ? 10 : 0,
                              child: _FeatureColumn(
                                eyebrow: 'How YenkasaAI helps the app',
                                title:
                                    'Platform intelligence for the Yenkasa product surface',
                                description:
                                    'Each capability is mapped to engineering and moderation workflows, not generic chatbot UX.',
                                items: landingFeatures,
                              ),
                            ),
                            SizedBox(
                              width: wide ? 20 : 0,
                              height: wide ? 0 : 20,
                            ),
                            Expanded(
                              flex: wide ? 13 : 0,
                              child: const _HeroSection(),
                            ),
                            SizedBox(
                              width: wide ? 20 : 0,
                              height: wide ? 0 : 20,
                            ),
                            Expanded(
                              flex: wide ? 10 : 0,
                              child: _FeatureColumn(
                                eyebrow: 'Benefits to Yenkasa',
                                title:
                                    'A safer, faster, more measurable platform',
                                description:
                                    'This is where the AI stack becomes an operating advantage, not just a feature.',
                                items: benefitCards,
                                numbered: true,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 22),
                    GlassCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SectionHeader(
                            eyebrow: 'Powers more than just Yenkasa',
                            title:
                                'Shared AI capabilities ready for APIs, copilots, and moderation services',
                            description:
                                'The same backend knowledge, moderation logic, and analytics surfaces can power multiple products.',
                          ),
                          const SizedBox(height: 20),
                          Wrap(
                            spacing: 16,
                            runSpacing: 16,
                            children: platformModules
                                .map(
                                  (module) => SizedBox(
                                    width: 240,
                                    child: GlassCard(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Chip(label: Text(module.tag)),
                                          const SizedBox(height: 14),
                                          Text(
                                            module.title,
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            module.subtitle,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodyMedium
                                                ?.copyWith(height: 1.5),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 22),
                    GlassCard(
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final compactMission = constraints.maxWidth < 920;
                          return Flex(
                            direction: compactMission
                                ? Axis.vertical
                                : Axis.horizontal,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (compactMission)
                                const SectionHeader(
                                  eyebrow: 'Mission',
                                  title:
                                      'Use AI to build a better Yenkasa, help creators grow, protect communities, and power the next generation of products.',
                                  description:
                                      'This frontend is prepared for voice input, auth-aware AI history, creator tooling, and moderation-grade retrieval experiences.',
                                )
                              else
                                const Expanded(
                                  child: SectionHeader(
                                    eyebrow: 'Mission',
                                    title:
                                        'Use AI to build a better Yenkasa, help creators grow, protect communities, and power the next generation of products.',
                                    description:
                                        'This frontend is prepared for voice input, auth-aware AI history, creator tooling, and moderation-grade retrieval experiences.',
                                  ),
                                ),
                              SizedBox(
                                width: compactMission ? 0 : 18,
                                height: compactMission ? 18 : 0,
                              ),
                              ConstrainedBox(
                                constraints: const BoxConstraints(
                                  maxWidth: 360,
                                ),
                                child: const GlassCard(
                                  strong: true,
                                  child: AppLogo(compact: true),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeroSection extends StatelessWidget {
  const _HeroSection();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GlassCard(
          strong: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.auto_awesome_rounded,
                    color: Color(0xFF7C3AED),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Building YenkasaAI',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Text(
                'YenkasaAI as an AI operating system for moderation, engineering, and platform intelligence.',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Inspired by the architecture you shared, this interface turns the same structure into an interactive cloud-native dashboard: generation, retrieval, moderation, ingestion, and analytics all exposed through one premium control plane.',
                style: Theme.of(
                  context,
                ).textTheme.bodyLarge?.copyWith(height: 1.7),
              ),
              const SizedBox(height: 24),
              Wrap(
                spacing: 16,
                runSpacing: 16,
                children: poweredBy
                    .map(
                      (item) => SizedBox(
                        width: 160,
                        child: MetricCard(
                          label: item.label,
                          value: item.value,
                          note: item.note,
                        ),
                      ),
                    )
                    .toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _FeatureColumn extends StatelessWidget {
  const _FeatureColumn({
    required this.eyebrow,
    required this.title,
    required this.description,
    required this.items,
    this.numbered = false,
  });

  final String eyebrow;
  final String title;
  final String description;
  final List<InsightCardData> items;
  final bool numbered;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      strong: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            eyebrow: eyebrow,
            title: title,
            description: description,
          ),
          const SizedBox(height: 20),
          for (var index = 0; index < items.length; index++) ...[
            _FeatureTile(
              item: items[index],
              numbered: numbered,
              index: index + 1,
            ),
            if (index != items.length - 1) const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }
}

class _FeatureTile extends StatelessWidget {
  const _FeatureTile({
    required this.item,
    required this.numbered,
    required this.index,
  });

  final InsightCardData item;
  final bool numbered;
  final int index;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              gradient: numbered
                  ? const LinearGradient(
                      colors: [
                        Color(0xFF5B21B6),
                        Color(0xFF7C3AED),
                        Color(0xFF3B82F6),
                      ],
                    )
                  : null,
              color: numbered ? null : const Color(0xFFEDE9FE),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: numbered
                  ? Text(
                      '$index',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    )
                  : Icon(
                      IconData(item.icon, fontFamily: 'MaterialIcons'),
                      color: const Color(0xFF6D28D9),
                    ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.title,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text(
                  item.description,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(height: 1.55),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
