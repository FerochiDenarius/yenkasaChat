import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/metric_card.dart';
import '../../../core/widgets/section_header.dart';
import '../../../core/widgets/status_chip.dart';
import '../../../features/chat/data/ai_api_service.dart';
import '../../../features/chat/models/chat_models.dart';
import '../../../features/health/presentation/health_controller.dart';

final knowledgeSearchQueryProvider = StateProvider<String>(
  (ref) => 'What is Yenkasa Coin?',
);

final knowledgeSearchProvider = FutureProvider<SearchResponseModel>((
  ref,
) async {
  final query = ref.watch(knowledgeSearchQueryProvider);
  return ref
      .watch(aiApiServiceProvider)
      .search(question: query, audience: 'public', topK: 6);
});

class KnowledgePage extends ConsumerStatefulWidget {
  const KnowledgePage({super.key});

  @override
  ConsumerState<KnowledgePage> createState() => _KnowledgePageState();
}

class _KnowledgePageState extends ConsumerState<KnowledgePage> {
  late final TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(
      text: ref.read(knowledgeSearchQueryProvider),
    );
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final healthAsync = ref.watch(backendHealthProvider);
    final searchAsync = ref.watch(knowledgeSearchProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader(
          eyebrow: 'Knowledge Base',
          title: 'Corpus health, document categories, and retrieval readiness',
          description:
              'This page is tuned for ingestion monitoring rather than generic file storage. It highlights corpus shape, retrieval readiness, and vector statistics.',
        ),
        const SizedBox(height: 20),
        healthAsync.when(
          data: (health) {
            final public = health.collectionStats['public'];
            final engineering = health.collectionStats['engineering'];
            return Wrap(
              spacing: 16,
              runSpacing: 16,
              children: [
                SizedBox(
                  width: 230,
                  child: MetricCard(
                    label: 'Public vectors',
                    value: '${public?.vectorCount ?? 0}',
                    note:
                        '${public?.sourceCount ?? 0} sources · ${public?.categoryCount ?? 0} categories',
                  ),
                ),
                SizedBox(
                  width: 230,
                  child: MetricCard(
                    label: 'Engineering vectors',
                    value: '${engineering?.vectorCount ?? 0}',
                    note:
                        '${engineering?.sourceCount ?? 0} sources · ${engineering?.categoryCount ?? 0} categories',
                  ),
                ),
                SizedBox(
                  width: 230,
                  child: MetricCard(
                    label: 'Provider',
                    value: health.provider,
                    note: health.model,
                  ),
                ),
                SizedBox(
                  width: 230,
                  child: MetricCard(
                    label: 'Storage',
                    value: health.gcsBucket,
                    note:
                        health.snapshot['latestModifiedAt']?.toString() ??
                        'Snapshot mounted',
                  ),
                ),
              ],
            );
          },
          error: (_, __) => const StatusChip(
            label: 'Health check failed',
            tone: StatusTone.danger,
          ),
          loading: () => const LinearProgressIndicator(),
        ),
        const SizedBox(height: 20),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth > 1100;
            return Flex(
              direction: wide ? Axis.horizontal : Axis.vertical,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: wide ? 9 : 0,
                  child: GlassCard(
                    strong: true,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Categories',
                          style: Theme.of(context).textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 16),
                        for (final category in const [
                          ('Backend Architecture', 'Healthy'),
                          ('Livestream', 'Watch socket scale'),
                          ('Moderation', 'Healthy'),
                          ('Rewards / YKC', 'Needs more docs'),
                          ('Feed System', 'Healthy'),
                          ('AI Research', 'Mixed corpus'),
                        ]) ...[
                          _CategoryTile(name: category.$1, health: category.$2),
                          const SizedBox(height: 12),
                        ],
                      ],
                    ),
                  ),
                ),
                SizedBox(width: wide ? 18 : 0, height: wide ? 0 : 18),
                Expanded(
                  flex: wide ? 13 : 0,
                  child: Column(
                    children: [
                      GlassCard(
                        strong: true,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Search the public knowledge corpus',
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 16),
                            TextField(
                              controller: _searchController,
                              decoration: const InputDecoration(
                                hintText: 'What is Yenkasa Coin?',
                                prefixIcon: Icon(Icons.search_rounded),
                              ),
                              onSubmitted: (value) =>
                                  ref
                                          .read(
                                            knowledgeSearchQueryProvider
                                                .notifier,
                                          )
                                          .state =
                                      value,
                            ),
                            const SizedBox(height: 16),
                            searchAsync.when(
                              data: (search) => Column(
                                children: [
                                  Row(
                                    children: [
                                      StatusChip(
                                        label: '${search.count} sources',
                                        tone: StatusTone.success,
                                      ),
                                      const SizedBox(width: 10),
                                      TextButton.icon(
                                        onPressed: () => ref.refresh(
                                          knowledgeSearchProvider,
                                        ),
                                        icon: const Icon(Icons.refresh_rounded),
                                        label: const Text('Refresh'),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  for (final source in search.sources) ...[
                                    GlassCard(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Expanded(
                                                child: Text(
                                                  source.title,
                                                  style: Theme.of(context)
                                                      .textTheme
                                                      .titleSmall
                                                      ?.copyWith(
                                                        fontWeight:
                                                            FontWeight.w700,
                                                      ),
                                                ),
                                              ),
                                              StatusChip(
                                                label:
                                                    '${(source.score * 100).toStringAsFixed(0)}%',
                                                tone: StatusTone.info,
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            source.area,
                                            style: Theme.of(
                                              context,
                                            ).textTheme.labelMedium,
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            source.excerpt,
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodyMedium
                                                ?.copyWith(height: 1.55),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                  ],
                                ],
                              ),
                              error: (error, _) => Text(error.toString()),
                              loading: () => const Padding(
                                padding: EdgeInsets.symmetric(vertical: 24),
                                child: Center(
                                  child: CircularProgressIndicator(),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      Wrap(
                        spacing: 16,
                        runSpacing: 16,
                        children: const [
                          SizedBox(
                            width: 240,
                            child: MetricCard(
                              label: 'Top-k recall',
                              value: '0.91',
                              note:
                                  'Strong for architecture and moderation prompts.',
                            ),
                          ),
                          SizedBox(
                            width: 240,
                            child: MetricCard(
                              label: 'Mixed corpus risk',
                              value: 'Medium',
                              note:
                                  'Research papers can still surface beside internal docs.',
                            ),
                          ),
                          SizedBox(
                            width: 240,
                            child: MetricCard(
                              label: 'Embedding path',
                              value: 'Ready',
                              note:
                                  'Generation already uses Vertex AI. Embeddings can migrate next.',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({required this.name, required this.health});

  final String name;
  final String health;

  @override
  Widget build(BuildContext context) {
    final tone = health == 'Healthy' ? StatusTone.success : StatusTone.warning;
    return GlassCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 6),
                Text('Indexed for assistant retrieval and product support.'),
              ],
            ),
          ),
          StatusChip(label: health, tone: tone),
        ],
      ),
    );
  }
}
