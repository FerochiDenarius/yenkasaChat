import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/yenkasa_ai_app.dart';
import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_logo.dart';
import '../../../core/widgets/glass_card.dart';
import '../../health/presentation/health_controller.dart';
import '../../health/presentation/health_indicator.dart';

class NavDestinationItem {
  const NavDestinationItem({
    required this.route,
    required this.label,
    required this.icon,
  });

  final String route;
  final String label;
  final IconData icon;
}

const navItems = <NavDestinationItem>[
  NavDestinationItem(
    route: '/chat',
    label: 'AI Chat',
    icon: Icons.smart_toy_outlined,
  ),
  NavDestinationItem(
    route: '/knowledge',
    label: 'Knowledge Base',
    icon: Icons.dataset_linked_outlined,
  ),
  NavDestinationItem(
    route: '/moderation',
    label: 'Moderation',
    icon: Icons.gpp_good_outlined,
  ),
  NavDestinationItem(
    route: '/analytics',
    label: 'Analytics',
    icon: Icons.analytics_outlined,
  ),
  NavDestinationItem(
    route: '/ingestion',
    label: 'Ingestion',
    icon: Icons.upload_file_outlined,
  ),
];

class AiShell extends ConsumerWidget {
  const AiShell({
    super.key,
    required this.currentLocation,
    required this.child,
  });

  final String currentLocation;
  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDesktop = MediaQuery.sizeOf(context).width >= 1100;
    final themeMode = ref.watch(themeModeProvider);
    final isChatRoute = currentLocation.startsWith('/chat');

    final scaffold = Scaffold(
      backgroundColor: Colors.transparent,
      drawer: isDesktop ? null : const _SidebarDrawer(),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compactTopBar = constraints.maxWidth < 760;
            return Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFF0A0B15),
                    Color(0xFF111325),
                    Color(0xFF0F1020),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
              child: Row(
                children: [
                  if (isDesktop)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: _SidebarPanel(currentLocation: currentLocation),
                    ),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.fromLTRB(
                        isDesktop ? 0 : 16,
                        16,
                        16,
                        16,
                      ),
                      child: Column(
                        children: [
                          if (compactTopBar && isChatRoute) ...[
                            _CompactChatTopBar(
                              onOpenDrawer: isDesktop
                                  ? null
                                  : () => Scaffold.of(context).openDrawer(),
                              onOpenSettings: () {
                                ref
                                    .read(themeModeProvider.notifier)
                                    .state = themeMode == ThemeMode.dark
                                    ? ThemeMode.light
                                    : ThemeMode.dark;
                              },
                            ),
                            const SizedBox(height: 14),
                            Container(
                              height: 1,
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ] else
                            GlassCard(
                              strong: true,
                              padding: EdgeInsets.symmetric(
                                horizontal: compactTopBar ? 14 : 20,
                                vertical: compactTopBar ? 12 : 16,
                              ),
                              child: compactTopBar
                                  ? Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            if (!isDesktop)
                                              Builder(
                                                builder: (context) =>
                                                    IconButton(
                                                      visualDensity:
                                                          VisualDensity.compact,
                                                      onPressed: () =>
                                                          Scaffold.of(
                                                            context,
                                                          ).openDrawer(),
                                                      icon: const Icon(
                                                        Icons.menu_rounded,
                                                      ),
                                                    ),
                                              ),
                                            Expanded(
                                              child: Text(
                                                isChatRoute
                                                    ? 'AI Chat'
                                                    : 'YenkasaAI',
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleSmall
                                                    ?.copyWith(
                                                      fontWeight:
                                                          FontWeight.w700,
                                                    ),
                                              ),
                                            ),
                                            const HealthIndicator(
                                              compact: true,
                                            ),
                                            const SizedBox(width: 6),
                                            IconButton(
                                              visualDensity:
                                                  VisualDensity.compact,
                                              onPressed: () {
                                                ref
                                                        .read(
                                                          themeModeProvider
                                                              .notifier,
                                                        )
                                                        .state =
                                                    themeMode == ThemeMode.dark
                                                    ? ThemeMode.light
                                                    : ThemeMode.dark;
                                              },
                                              icon: Icon(
                                                themeMode == ThemeMode.dark
                                                    ? Icons.light_mode_rounded
                                                    : Icons.dark_mode_rounded,
                                              ),
                                            ),
                                          ],
                                        ),
                                        if (!isChatRoute) ...[
                                          const SizedBox(height: 10),
                                          TextField(
                                            decoration: InputDecoration(
                                              hintText:
                                                  'Search prompts or docs',
                                              prefixIcon: const Icon(
                                                Icons.search_rounded,
                                              ),
                                              suffixIcon: IconButton(
                                                onPressed: () =>
                                                    context.go('/knowledge'),
                                                icon: const Icon(
                                                  Icons.arrow_forward_rounded,
                                                ),
                                              ),
                                            ),
                                            onSubmitted: (_) =>
                                                context.go('/knowledge'),
                                          ),
                                        ],
                                      ],
                                    )
                                  : Row(
                                      children: [
                                        if (isChatRoute) ...[
                                          if (!isDesktop)
                                            Builder(
                                              builder: (context) => IconButton(
                                                onPressed: () => Scaffold.of(
                                                  context,
                                                ).openDrawer(),
                                                icon: const Icon(
                                                  Icons.menu_rounded,
                                                ),
                                              ),
                                            ),
                                          if (!isDesktop)
                                            const SizedBox(width: 8),
                                          Text(
                                            'AI Chat',
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                  fontWeight: FontWeight.w700,
                                                ),
                                          ),
                                          const Spacer(),
                                          const HealthIndicator(),
                                          const SizedBox(width: 12),
                                          IconButton(
                                            onPressed: () {
                                              ref
                                                      .read(
                                                        themeModeProvider
                                                            .notifier,
                                                      )
                                                      .state =
                                                  themeMode == ThemeMode.dark
                                                  ? ThemeMode.light
                                                  : ThemeMode.dark;
                                            },
                                            icon: Icon(
                                              themeMode == ThemeMode.dark
                                                  ? Icons.light_mode_rounded
                                                  : Icons.dark_mode_rounded,
                                            ),
                                          ),
                                        ] else ...[
                                          if (!isDesktop)
                                            Builder(
                                              builder: (context) => IconButton(
                                                onPressed: () => Scaffold.of(
                                                  context,
                                                ).openDrawer(),
                                                icon: const Icon(
                                                  Icons.menu_rounded,
                                                ),
                                              ),
                                            ),
                                          if (!isDesktop)
                                            const SizedBox(width: 8),
                                          Expanded(
                                            child: TextField(
                                              decoration: InputDecoration(
                                                hintText:
                                                    'Search prompts, architecture, moderation, or rewards',
                                                prefixIcon: const Icon(
                                                  Icons.search_rounded,
                                                ),
                                                suffixIcon: IconButton(
                                                  onPressed: () =>
                                                      context.go('/knowledge'),
                                                  icon: const Icon(
                                                    Icons.arrow_forward_rounded,
                                                  ),
                                                ),
                                              ),
                                              onSubmitted: (_) =>
                                                  context.go('/knowledge'),
                                            ),
                                          ),
                                          const SizedBox(width: 16),
                                          const HealthIndicator(),
                                          const SizedBox(width: 12),
                                          IconButton(
                                            onPressed: () {
                                              ref
                                                      .read(
                                                        themeModeProvider
                                                            .notifier,
                                                      )
                                                      .state =
                                                  themeMode == ThemeMode.dark
                                                  ? ThemeMode.light
                                                  : ThemeMode.dark;
                                            },
                                            icon: Icon(
                                              themeMode == ThemeMode.dark
                                                  ? Icons.light_mode_rounded
                                                  : Icons.dark_mode_rounded,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                            ),
                          const SizedBox(height: 16),
                          Expanded(
                            child: isChatRoute
                                ? child
                                : SingleChildScrollView(child: child),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );

    return scaffold;
  }
}

class _SidebarDrawer extends StatelessWidget {
  const _SidebarDrawer();

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: Colors.transparent,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: _SidebarPanel(
          currentLocation: GoRouterState.of(context).uri.path,
          scrollable: true,
        ),
      ),
    );
  }
}

class _SidebarPanel extends StatelessWidget {
  const _SidebarPanel({required this.currentLocation, this.scrollable = false});

  final String currentLocation;
  final bool scrollable;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      width: scrollable ? double.infinity : 298,
      child: GlassCard(
        strong: true,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const AppLogo(),
              const SizedBox(height: 28),
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  gradient: const LinearGradient(
                    colors: [
                      Color(0xFF5B21B6),
                      Color(0xFF7C3AED),
                      Color(0xFF3B82F6),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Control Plane',
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: Colors.white70,
                        letterSpacing: 1.6,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Engineering intelligence workspace',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'RAG answers, moderation signals, ingestion health, and infrastructure analytics in one place.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white70,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 18),
                    FilledButton.tonal(
                      onPressed: () => context.go('/'),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white.withValues(alpha: 0.18),
                        foregroundColor: Colors.white,
                      ),
                      child: const Text('Launchpad'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              for (final item in navItems)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: _NavButton(
                    item: item,
                    active: currentLocation == item.route,
                  ),
                ),
              SizedBox(height: scrollable ? 24 : 72),
              GlassCard(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Runtime',
                      style: theme.textTheme.labelMedium?.copyWith(
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _runtimeRow(context, 'Generation', 'Vertex AI'),
                    const SizedBox(height: 10),
                    _runtimeRow(context, 'Retrieval', 'Chroma + HF'),
                    const SizedBox(height: 10),
                    _runtimeRow(context, 'Future', 'Voice + Auth'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _runtimeRow(BuildContext context, String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(color: Colors.white70),
        ),
        Text(
          value,
          style: Theme.of(
            context,
          ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({required this.item, required this.active});

  final NavDestinationItem item;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: active ? const Color(0xFF7C3AED) : Colors.transparent,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => context.go(item.route),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          child: Row(
            children: [
              Icon(item.icon, color: active ? Colors.white : null, size: 20),
              const SizedBox(width: 12),
              Text(
                item.label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: active ? Colors.white : null,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactChatTopBar extends StatelessWidget {
  const _CompactChatTopBar({
    required this.onOpenDrawer,
    required this.onOpenSettings,
  });

  final VoidCallback? onOpenDrawer;
  final VoidCallback onOpenSettings;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconButton(
          onPressed: onOpenDrawer,
          icon: const Icon(Icons.menu_rounded, size: 28),
        ),
        const SizedBox(width: 8),
        const _CompactBrandLockup(),
        const Spacer(),
        const _HeaderPresencePill(),
        const SizedBox(width: 12),
        _HeaderCircleButton(icon: Icons.tune_rounded, onTap: onOpenSettings),
      ],
    );
  }
}

class _CompactBrandLockup extends StatelessWidget {
  const _CompactBrandLockup();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AiPalette.violet.withValues(alpha: 0.4)),
          ),
          clipBehavior: Clip.antiAlias,
          child: Image.asset(AppConfig.logoAsset, fit: BoxFit.cover),
        ),
        const SizedBox(width: 12),
        Text(
          'Yenkasa AI',
          style: Theme.of(
            context,
          ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _HeaderPresencePill extends ConsumerWidget {
  const _HeaderPresencePill();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(backendHealthProvider);
    final online = healthAsync.maybeWhen(
      data: (_) => true,
      orElse: () => false,
    );
    final label = healthAsync.when(
      data: (_) => 'Online',
      loading: () => 'Checking',
      error: (_, __) => 'Offline',
    );
    final dotColor = online
        ? AiPalette.mint
        : Colors.white.withValues(alpha: 0.5);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.02),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              boxShadow: online
                  ? [
                      BoxShadow(
                        color: dotColor.withValues(alpha: 0.5),
                        blurRadius: 12,
                        spreadRadius: 1,
                      ),
                    ]
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
              color: online
                  ? AiPalette.mint
                  : Colors.white.withValues(alpha: 0.8),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _HeaderCircleButton extends StatelessWidget {
  const _HeaderCircleButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: IconButton(onPressed: onTap, icon: Icon(icon, size: 22)),
    );
  }
}
